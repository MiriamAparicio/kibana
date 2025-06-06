# Kibana task manager

The task manager is a generic system for running background tasks.

[Documentation](https://www.elastic.co/docs/deploy-manage/distributed-architecture/kibana-tasks-management)

It supports:

- Single-run and recurring tasks
- Scheduling tasks to run after a specified datetime
- Basic retry logic
- Recovery of stalled tasks / timeouts
- Tracking task state across multiple runs
- Running tasks with user-scoped permissions
- Configuring the run-parameters for specific tasks
- Basic coordination to prevent the same task instance from running on more than one Kibana system at a time

## Implementation details

At a high-level, the task manager works like this:

- Every `{poll_interval}` milliseconds, check the `.kibana_task_manager` index for any tasks that need to be run:
  - `runAt` or `retryAt` is past
  - `attempts` is less than the configured threshold
- Attempt to claim the task by using optimistic concurrency to set:
  - status to `running`
  - `startedAt` to now
  - `retryAt` to next time task should retry if it times out and is still in `running` status
- Run the task, if the claim succeeded
- If the task fails, increment the `attempts` count and reschedule it
- If the task succeeds:
  - If it is recurring, store the result of the run, and reschedule
  - If it is not recurring, remove it from the index

## Pooling

Each task manager instance runs tasks in a pool which ensures that at most N tasks are run at a time, where N is configurable. This prevents the system from running too many tasks at once in resource constrained environments. In addition to this, each individual task type definition can have `capacity` specified, which tells the system how much capacity is required to run a single instance of the task. This effectively limits how many tasks of a given type can be run at once.

For example, we may have a system with a total `capacity` of 20, but a super expensive task such as an indicator match alerting rule which specifies a `capacity` of 10. In this case, `alerting:siem.indicatorRule` task can only run two at a time.

## Config options

The task_manager can be configured via `taskManager` config options (e.g. `xpack.taskManager.max_attempts`):

- `max_attempts` - The maximum number of times a task will be attempted before being abandoned as failed
- `poll_interval` - How often the background worker should check the task_manager index for more work
- `index` - **deprecated** The name of the index that the task_manager will use. This is deprecated, and will be removed starting in 8.0
- `max_workers` - **deprecated** The maximum number of tasks a Kibana will run concurrently (defaults to 10)
- `capacity` - The maximum capacity Kibana can handle concurrently (defaults to 20)
- `version_conflict_threshold` - The threshold percentage for workers experiencing version conflicts for shifting the polling interval
- `monitored_aggregated_stats_refresh_rate` - Dictates how often we refresh the "Cold" metrics. Learn More: [./MONITORING](./MONITORING.MD)
- `monitored_stats_running_average_window`- Dictates the size of the window used to calculate the running average of various "Hot" stats. Learn More: [./MONITORING](./MONITORING.MD)
- `monitored_stats_required_freshness` - Dictates the _required freshness_ of critical "Hot" stats. Learn More: [./MONITORING](./MONITORING.MD)
- `monitored_task_execution_thresholds`- Dictates the threshold of failed task executions. Learn More: [./MONITORING](./MONITORING.MD)
- `unsafe.exclude_task_types` - A list of task types to exclude from running. Supports wildcard usage, such as `namespace:*`. This configuration is experimental, unsupported, and can only be used for temporary debugging purposes because it causes Kibana to behave in unexpected ways.

## Task definitions

Plugins define tasks by calling the `registerTaskDefinitions` method on the `server.plugins.task_manager` object.

A sample task can be found in the [x-pack/platform/test/plugin_api_integration/plugins/sample_task_plugin/](../../../../../x-pack/platform/test/plugin_api_integration/plugins/sample_task_plugin/server/plugin.ts) folder.

```js
export class Plugin {
  constructor() {}

  public setup(core: CoreSetup, plugins: { taskManager }) {
    taskManager.registerTaskDefinitions({
      // clusterMonitoring is the task type, and must be unique across the entire system
      clusterMonitoring: {
        // Human friendly name, used to represent this task in logs, UI, etc
        title: 'Human friendly name',

        // Optional, human-friendly, more detailed description
        description: 'Amazing!!',

        // Optional, how long, in minutes or seconds, the system should wait before
        // a running instance of this task is considered to be timed out.
        // This defaults to 5 minutes.
        timeout: '5m',

        // Optional, how many attempts before marking task as failed.
        // This defaults to what is configured at the task manager level.
        maxAttempts: 5,

        // The maximum number tasks of this type that can be run concurrently per Kibana instance.
        // Setting this value will force Task Manager to poll for this task type seperatly from other task types which
        // can add significant load to the ES cluster, so please use this configuration only when absolutly necesery.
        maxConcurrency: 1,

        // To ensure the validity of task state during read and write operations, utilize the stateSchemaByVersion configuration. This functionality validates the state before executing a task. Make sure to define the schema property using the @kbn/config-schema plugin, specifically as an ObjectType (schema.object) at the top level.
        stateSchemaByVersion: {
          1: {
            schema: schema.object({
              count: schema.number(),
            }),
            up: (state) => {
              return {
                count: state.count || 0,
              };
            },
          }
        }

        // The createTaskRunner function / method returns an object that is responsible for
        // performing the work of the task. context: { taskInstance }, is documented below.
        createTaskRunner(context) {
          return {
            // Perform the work of the task. The return value should fit the TaskResult interface, documented
            // below. Invalid return values will result in a logged warning.
            async run() {
              // Do some work
              // Conditionally send some alerts
              // Return some result or other...
            },

            // Optional, will be called if a running instance of this task times out, allowing the task
            // to attempt to clean itself up.
            async cancel() {
              // Do whatever is required to cancel this task, such as killing any spawned processes
            },
          };
        },
      },
    });
  }

  public start(core: CoreStart, plugins: { taskManager }) {}
}
```

When Kibana attempts to claim and run a task instance, it looks its definition up, and executes its createTaskRunner's method, passing it a run context which looks like this:

```js
{
  // The data associated with this instance of the task, with two properties being most notable:
  //
  // params:
  // An object, specific to this task instance, used by the
  // task to determine exactly what work should be performed.
  // e.g. a cluster-monitoring task might have a `clusterName`
  // property in here, but a movie-monitoring task might have
  // a `directorName` property.
  //
  // state:
  // The state returned from the previous run of this task instance.
  // If this task instance has never succesfully run, this will
  // be an empty object: {}
  taskInstance,
}
```

## Task result

The task runner's `run` method is expected to return a promise that resolves to undefined or to an object that looks like the following:

| Property | Description                                                                                                                                   | Type                    |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| runAt    | Optional. If specified, this is used as the tasks' next `runAt`, overriding the default system scheduler.                                     | Date ISO String         |
| schedule | Optional. If specified, this is used as the tasks' new recurring schedule, overriding the default system scheduler and any existing schedule. | { interval: string }    |
| error    | Optional, an error object, logged out as a warning. The pressence of this property indicates that the task did not succeed.                   | Error                   |
| state    | Optional, this will be passed into the next run of the task, if this is a recurring task.                                                     | Record<string, unknown> |

### Examples

```js
{
  // Optional, if specified, this is used as the tasks' nextRun, overriding
  // the default system scheduler.
  runAt: "2020-07-24T17:34:35.272Z",

  error: { message: 'Hrumph!' },

  state: {
    anything: 'goes here',
  },
}
```

```js
{
  schedule: { interval: '30s' },

  state: {
    anything: 'goes here',
  },
}
```

Other return values will result in a warning, but the system should continue to work.

### Task retries when the Task Runner fails

If an ad hoc task fails, task manager will try to rerun the task shortly after (up to the task definition's `maxAttempts`).
Normal tasks will wait a default amount of 5m before trying again and every subsequent attempt will add an additonal 5m cool off period to avoid a stampeding herd of failed tasks from storming Elasticsearch.

Recurring tasks will also get retried, but instead of using the 5m interval for the retry, they will be retried on their next scheduled run.

### Force failing a task

If you wish to purposely fail a task, you can throw an error of any kind and the retry logic will apply.
If, on the other hand, you wish not only to fail the task, but you'd also like to indicate the Task Manager that it shouldn't retry the task, you can throw an Unrecoverable Error, using the `throwUnrecoverableError` helper function.

For example:

```js
  taskManager.registerTaskDefinitions({
    myTask: {
      /// ...
      createTaskRunner(context) {
        return {
          async run() {
            const result = ... // Do some work

            if(!result) {
              // No point retrying?
              throwUnrecoverableError(new Error("No point retrying, this is unrecoverable"));
            }

            return result;
          }
        };
      },
    },
  });
```

## Task instances

The task_manager module will store scheduled task instances in an index. This allows for recovery of failed tasks, coordination across Kibana clusters, persistence across Kibana reboots, etc.

The data stored for a task instance looks something like this:

```js
{
  // The type of task that will run this instance.
  taskType: 'clusterMonitoring',

  // The next time this task instance should run. It is not guaranteed
  // to run at this time, but it is guaranteed not to run earlier than
  // this.
  runAt: "2020-07-24T17:34:35.272Z",

  // Indicates that this is a recurring task. We support interval syntax
  // with days such as '1d', hours '3h', minutes such as `5m`, seconds `10s`.
  schedule: { interval: '5m' },

  // How many times this task has been unsuccesfully attempted,
  // this will be reset to 0 if the task ever succesfully completes.
  // This is incremented if a task fails or times out.
  attempts: 0,

  // Currently, this is either idle | claiming | running | failed. It is used to
  // coordinate which Kibana instance owns / is running a specific
  // task instance.
  // idle: Task Instance isn't being worked on
  // claiming: A Kibana instance has claimed ownership but hasn't started running
  //           the Task Instance yet
  // running: A Kibana instance has began working on the Task Instance
  // failed: The last run of the Task Instance failed, waiting to retry
  status: 'idle',

  // The params specific to this task instance, which will be
  // passed to the task when it runs, and will be used by the
  // task to determine exactly what work should be performed.
  // This is a JSON blob, and will be different per task type.
  // e.g. a cluster-monitoring task might have a `clusterName`
  // property in here, but a movie-monitoring task might have
  // a `directorName` property.
  params: '{ "task": "specific stuff here" }',

  // The result of the previous run of this task instance. This
  // will be passed to the next run of the task, along with the
  // params, and could be used by a task to do special logic If
  // the task state changes (e.g. from green to red, or foo to bar)
  // If there was no previous run (e.g. the instance has never succesfully
  // completed, this will be an empty object.). This is a JSON blob,
  // and will be different per task type.
  state: '{ "status": "green" }',

  // An application-specific designation, allowing different Kibana
  // plugins / apps to query for only those tasks they care about.
  scope: ['alerting'],

  // The Kibana UUID of the Kibana instance who last claimed ownership for running this task.
  ownerId: '123e4567-e89b-12d3-a456-426655440000'

  // Optionally store api key and user information for user-scoped tasks
  apiKey: 'gj8uVyHQsawz391jPfaM8yekKyrsETPiM4rT5zJPa48E8v9CjBTjRyjCkFTgwhlUMh6zkUCbP9C4he5/9X+9J6Qbcoj0vKVKtW/gW/y+vQmFZJpCsHrpmXgGjZ6tJcmwbnMziaQGPcnmg/EwDYCdWJiPo1J5SS0pEMhOiJPVN6kxParzAPSSSttpdRiJKlUdHU5P3AUkZruL7w=='

  userScope: {
    apiKeyId: 'URRriJYBRAfMJQhQ_YH-',
    spaceId: 'default',
    apiKeyCreatedByUser: false
  }
}
```

## Programmatic access

The task manager mixin exposes a taskManager object on the Kibana server which plugins can use to manage scheduled tasks. Each method takes an optional `scope` argument and ensures that only tasks with the specified scope(s) will be affected.

### Overview

Interaction with the Task Manager Plugin is done via the Kibana Platform Plugin system.
When developing your Plugin, you're asked to define a `setup` method and a `start` method.
These methods are handed Kibana's Plugin APIs for these two stages, which means you'll have access to the following apis in these two stages:

#### Setup

The _Setup_ Plugin api includes methods which configure Task Manager to support your Plugin's requirements, such as defining custom Middleware and Task Definitions.

```js
{
  addMiddleware: (middleware: Middleware) => {
    // ...
  },
  registerTaskDefinitions: (taskDefinitions: TaskDictionary<TaskDefinition>) => {
    // ...
  },
}
```

#### Start

The _Start_ Plugin api allow you to use Task Manager to facilitate your Plugin's behaviour, such as scheduling tasks.

```js
{
  fetch: (opts: SearchOpts) =>  {
    // ...
  },
  aggregate: (opts: AggregationOpts) => {
    // ...
  },
  remove: (id: string) =>  {
    // ...
  },
  removeIfExists: (id: string) => {
    // ...
  },
  get: (id: string) =>  {
    // ...
  },
  getRegisteredTypes: () => {
    // ...
  },
  schedule: (taskInstance: TaskInstanceWithDeprecatedFields, options?: ScheduleOptions) => {
    // ...
  },
  runSoon: (taskId: string) =>  {
    // ...
  },
  bulkEnable: (taskIds: string[], runSoon: boolean = true) => {
    // ...
  },
  bulkDisable: (taskIds: string[], clearStateIdsOrBoolean?: string[] | boolean) => {
    // ...
  },
  bulkUpdateSchedules: (taskIds: string[], schedule: IntervalSchedule) =>  {
    // ...
  },
  bulkUpdateState: (taskIds: string[], stateMapFn: (s: ConcreteTaskInstance['state'], id: string) => ConcreteTaskInstance['state']) => {
    // ...
  },
  bulkSchedule: (taskInstances: TaskInstanceWithDeprecatedFields[], options?: ScheduleOptions) => {
    // ...
  },
  bulkRemove: (ids: string[]) => {
    // ...
  },
  ensureScheduled: (taskInstance: TaskInstanceWithId, options?: any) => {
    // ...
  },
}
```

### Detailed APIs

#### fetch

Use `fetch` to query for tasks. This method takes an optional DSL query and an optional sort parameter. If no query is provided, all tasks are fetched and sorted by ascending `runAt` value. Set the `limitResponse` parameter to `true` to exclude the `state` and `params` fields from the result. This optimizes the call and reduces the size of the response since the task state and task params can grow large and must be deserialized on read.

#### aggregate

Use `aggregate` to aggregate tasks. This method takes an optional DSL query and optional runtime mappings.

#### remove

Use `remove` to remove a task instance by ID. If the task is user-scoped, the associated API key will be invalidated. This method will throw an error if the specified task does not exist.

#### removeIfExists

Use `removeIfExists` to remove a task instance by ID only if it exists. This method will not throw an error if the specified task does not exist.

#### get

Use `get` to get a task instance by ID.

#### getRegisteredTypes

Use `getRegisteredTypes` to get a list of all registered task types. This only returns the task types and not the full definition.

#### schedule

Use `schedule` to instruct TaskManager to schedule an instance of a TaskType at some point in the future.
Please check the [Schedule options](#schedule-options) for the scheduling config details

```js
export class Plugin {
  constructor() {}

  public setup(core: CoreSetup, plugins: { taskManager }) {}

  public start(core: CoreStart, plugins: { taskManager }) {
    // Schedules a task. All properties are as documented in the previous
    // storage section, except that here, params is an object, not a JSON
    // string.
    const task = await taskManager.schedule({
      taskType,
      runAt,
      schedule,
      params,
      scope: ['my-fanci-app'],
    });

    // Removes the specified task
    await taskManager.remove(task.id);
  }
}
```

#### bulkSchedule

Use `bulkSchedule` to schedule multiple tasks at one time using the same logic as the `schedule` API.

```js
export class Plugin {
  constructor() {}

  public setup(core: CoreSetup, plugins: { taskManager }) {}

  public start(core: CoreStart, plugins: { taskManager }) {
    try {
      // Schedules multiple tasks.
      const task = await taskManager.bulkSchedule([
        { taskType: 'task-type-1', runAt, schedule, params, scope: ['my-fanci-app'] },
        { taskType: 'task-type-2', runAt, schedule, params, scope: ['another-app'] },
      ]);
    } catch (err) {
      // Throws error if there are errors validating the task instance
      // or an invalid task type is specified.
    }
  }
}
```

#### ensureScheduled

When using the `schedule` API to schedule a Task you can provide a hard coded `id` on the Task. This tells TaskManager to use this `id` to identify the Task Instance rather than generating a random `id` on its own.
The danger is that in such a situation, a Task with that same `id` might already have been scheduled at some earlier point, resulting in an error. In some cases, this is the expected behavior, but often you only care about ensuring the task has been _scheduled_ and don't need it to be scheduled afresh.

To achieve this you should use the `ensureScheduled` api which has the exact same behavior as `schedule`, except it allows the scheduling of a Task with an `id` that's already in assigned to another Task and it will assume that the existing Task is the one you wished to `schedule`, treating this as a successful operation.

#### runSoon

Use `runSoon` to instruct TaskManager to run an existing task as soon as possible by updating the next scheduled run date to be `now`.

```js
export class Plugin {
  constructor() {}

  public setup(core: CoreSetup, plugins: { taskManager }) {}

  public start(core: CoreStart, plugins: { taskManager }) {
    try {
      const taskRunResult = await taskManager.runSoon('91760f10-ba42-de9799');
      // If no error is thrown, the task has completed successfully.
    } catch(err: Error) {
      // If running the task has failed, we throw an error with an appropriate message.
      // For example, if the requested task doesnt exist: `Error: failed to run task "91760f10-ba42-de9799" as it does not exist`
      // Or if, for example, the task is already running: `Error: failed to run task "91760f10-ba42-de9799" as it is currently running`
    }
  }
}
```

#### bulkDisable

Use `bulkDisable` to instruct TaskManger to disable tasks by setting the `enabled` status of specified tasks to `false`.

Example:

```js
export class Plugin {
  constructor() {}

  public setup(core: CoreSetup, plugins: { taskManager }) {}

  public start(core: CoreStart, plugins: { taskManager }) {
    try {
      const bulkDisableResults = await taskManager.bulkDisable(
        ['97c2c4e7-d850-11ec-bf95-895ffd19f959', 'a5ee24d1-dce2-11ec-ab8d-cf74da82133d'],
      );
      // If no error is thrown, the bulkDisable has completed successfully.
      // But some updates of some tasks can be failed, due to OCC 409 conflict for example
    } catch(err: Error) {
      // if error is caught, means the whole method requested has failed and tasks weren't updated
    }
  }
}
```

#### bulkEnable

Use `bulkEnable` to instruct TaskManger to enable tasks by setting the `enabled` status of specified tasks to `true`. Specify the `runSoon` parameter to run the task immediately on enable.

Example:

```js
export class Plugin {
  constructor() {}

  public setup(core: CoreSetup, plugins: { taskManager }) {}

  public start(core: CoreStart, plugins: { taskManager }) {
    try {
      const bulkEnableResults = await taskManager.bulkEnable(
        ['97c2c4e7-d850-11ec-bf95-895ffd19f959', 'a5ee24d1-dce2-11ec-ab8d-cf74da82133d'],
        true,
      );
      // If no error is thrown, the bulkEnable has completed successfully.
      // But some updates of some tasks can be failed, due to OCC 409 conflict for example
    } catch(err: Error) {
      // if error is caught, means the whole method requested has failed and tasks weren't updated
    }
  }
}
```

#### bulkUpdateSchedules

Use `bulkUpdatesSchedules` to instruct TaskManger to update the schedule interval of tasks that are in `idle` status
(for the tasks which have `running` status, `schedule` and `runAt` will be recalculated after task run finishes).
When the interval is updated, new `runAt` will be computed and task will be updated with that value, using the formula

```
newRunAt = oldRunAt - oldInterval + newInterval
```

Example:

```js
export class Plugin {
  constructor() {}

  public setup(core: CoreSetup, plugins: { taskManager }) {}

  public start(core: CoreStart, plugins: { taskManager }) {
    try {
      const bulkUpdateResults = await taskManager.bulkUpdateSchedule(
        ['97c2c4e7-d850-11ec-bf95-895ffd19f959', 'a5ee24d1-dce2-11ec-ab8d-cf74da82133d'],
        { interval: '10m' },
      );
      // If no error is thrown, the bulkUpdateSchedule has completed successfully.
      // But some updates of some tasks can be failed, due to OCC 409 conflict for example
    } catch(err: Error) {
      // if error is caught, means the whole method requested has failed and tasks weren't updated
    }
  }
}
```

#### bulkUpdateState

Use `bulkUpdateState` to update the task state of specified task instances by ID. This method takes a callback function which takes as input the current task state and returns as output the new task state. The bulk update will be retried up to 2 times in case of conflict.

#### bulkRemove

Use `bulkRemove` to remove multiple task instances by ID. Similar to `remove`, this method will invalidate any API keys associated with the specified tasks.

#### more options

More custom access to the tasks can be done directly via Elasticsearch, though that won't be officially supported, as we can change the document structure at any time.

## Middleware

The task manager exposes a middleware layer that allows modifying tasks before they are scheduled / persisted to the task manager index, and modifying tasks / the run context before a task is run.

For example:

```js
export class Plugin {
  constructor() {}

  public setup(core: CoreSetup, plugins: { taskManager }) {
    taskManager.addMiddleware({
      async beforeSave({ taskInstance, ...opts }) {
        console.log(`About to save a task of type ${taskInstance.taskType}`);

        return {
          ...opts,
          taskInstance: {
            ...taskInstance,
            params: {
              ...taskInstance.params,
              example: 'Added to params!',
            },
          },
        };
      },

      async beforeRun({ taskInstance, ...opts }) {
        console.log(`About to run ${taskInstance.taskType} ${taskInstance.id}`);
        const { example, ...taskWithoutExampleProp } = taskInstance;

        return {
          ...opts,
          taskInstance: taskWithoutExampleProp,
        };
      },
    });
  }

  public start(core: CoreStart, plugins: { taskManager }) {}
}
```

## Task Poller: polling for work

TaskManager used to work in a `pull` model, but it now needs to support both `push` and `pull`, so it has been remodeled internally to support a single `push` model.

Task Manager's _push_ mechanism is driven by the following operations:

1. A polling interval has been reached.
2. A new Task is scheduled.

The polling interval is straight forward: TaskPoller is configured to emit an event at a fixed interval.
That said, if there are no workers available, we want to ignore these events, so we'll throttle the interval on worker availability.

Whenever a user uses the `schedule` api to schedule a new Task, we want to trigger an early polling in order to respond to the newly scheduled task as soon as possible, but this too we only wish to do if there are available workers, so we can throttle this too.

However, besides above operations `runSoon` can be used to run a task.
`runSoon` updates a tasks `runAt` and `scheduledAt` properties with current date-time stamp.
So the task would be picked up at the next TaskManager polling cycle by one of the Kibana instances that has capacity.

We now want to respond to all three of these events, but we still need to balance against our worker capacity, so if there are too many requests buffered, we only want to `take` as many requests as we have capacity to handle.
Luckily, `Polling Interval` and `Task Scheduled` simply denote a request to "poll for work as soon as possible", and `Run Task Soon` simply adds the task to the current buffer.

We achieve this model by buffering requests into a queue using a Set (which removes duplicated). As we don't want an unbounded queue in our system, we have limited the size of this queue (configurable by the `xpack.task_manager.request_capacity` config, defaulting to 1,000 requests) which forces us to throw an error once this cap is reached until the queue drain bellow the cap.

Our current model, then, is this:

```
  Polling Interval  --> filter(availableWorkers > 0) - mapTo([]) -------\\
  Task Scheduled    --> filter(availableWorkers > 0) - mapTo([]) --------||==>Set([]+[]+[`1`,`2`]) ==> work([`1`,`2`])
  Run Task `1` Now --\                                                  //
                      ----> buffer(availableWorkers > 0) -- [`1`,`2`] -//
  Run Task `2` Now --/
```

## Limitations in v1.0

There is only a rudimentary mechanism for coordinating tasks and handling expired tasks. Tasks are considered expired if their runAt has arrived, and their status is still 'running'.

There is no task history. Each run overwrites the previous run's state. One-time tasks are removed from the index upon completion.

The task manager's public API is create / delete / list. Updates aren't directly supported, and listing should be scoped so that users only see their own tasks.

## Testing

- Unit tests:

  Documentation: https://www.elastic.co/guide/en/kibana/current/development-tests.html#_unit_testing

  ```
  yarn test:jest x-pack/platform/plugins/shared/task_manager --watch
  ```

- Integration tests:
  ```
  node scripts/functional_tests_server.js --config x-pack/platform/test/plugin_api_integration/config.ts
  node scripts/functional_test_runner --config x-pack/platform/test/plugin_api_integration/config.ts
  ```

## Monitoring

Task Manager exposes runtime statistics which enable basic observability into its inner workings and makes it possible to monitor the system from external services.

Public Documentation: https://www.elastic.co/guide/en/kibana/master/task-manager-health-monitoring.html
Developer Documentation: [./MONITORING](./MONITORING.MD)

## Schedule options

### Task recurrence

Recurring tasks can specify a schedule using one of the following configurations:

- `schedule.interval`
  This is a basic duration string such as `1h`,`3m` or `7d` etc.

- `schedule.rrule`
  This is a subset of the rrule library.
  We currently support only daily, weekly and monthly schedules.

#### Monthly schedule options

```typescript
  freq: Frequency.MONTHLY, -> Import the enum Frequency from TaskManager (Required field)
  interval: number; -> Any number. 1 means `every 1 month` (Required field)
  tzid: string; -> Timezone e.g.: 'UTC' (Required field)
  bymonthday: number[]; -> number between 1 and 31
  byhour?: number[]; -> number between 0 and 23
  byminute?: number[]; -> number between 0 and 59
  byweekday?: Weekday[]; -> Import the enum Weekday from TaskManager. Weekday.MO is monday
```

#### Weekly schedule options

```typescript
  freq: Frequency.WEEKLY, -> Import the enum Frequency from TaskManager (Required field)
  interval: number; -> Any number. 1 means `every 1 week` (Required field)
  tzid: string; -> Timezone e.g.: 'UTC' (Required field)
  byhour?: number[]; -> number between 0 and 23
  byminute?: number[]; -> number between 0 and 59
  byweekday?: Weekday[]; -> Import the enum Weekday from TaskManager. Weekday.MO is monday
```

#### Daily schedule options

```typescript
  freq: Frequency.DAILY, -> Import the enum Frequency from TaskManager (Required field)
  interval: number; -> Any number. 1 means `every 1 day` (Required field)
  tzid: string; -> Timezone e.g.: 'UTC' (Required field)
  byhour?: number[]; -> number between 0 and 23
  byminute?: number[]; -> number between 0 and 59
  byweekday?: Weekday[]; -> Import the enum Weekday from TaskManager. Weekday.MO is monday
```

#### Rrule Examples

Every day at current time:

```js
  schedule: {
    rrule: {
      freq: Frequency.DAILY,
      tzid: 'UTC',
      interval: 1
    }
  }
```

Every day at 13:15:

```js
  schedule: {
    rrule: {
      freq: Frequency.DAILY,
      tzid: 'UTC',
      interval: 1,
      byhour: [13],
      byminute: [15]
    }
  }
```

Every Monday at 17:30:

```js
  schedule: {
    rrule: {
      freq: Frequency.DAILY,
      tzid: 'UTC',
      interval: 1,
      byhour: [17],
      byminute: [30]
      byweekday: Weekday.MO
    }
  }
```

Every 2 weeks on Friday at 08:45:

```js
  schedule: {
    rrule: {
      freq: Frequency.WEEKLY,
      tzid: 'UTC',
      interval: 2,
      byhour: [8],
      byminute: [45]
      byweekday: Weekday.FR
    }
  }
```

Every Month on 1st, 15th and 30th at 12:10 and 18:10:

```js
  schedule: {
    rrule: {
      freq: Frequency.MONTHLY,
      tzid: 'UTC',
      interval: 1,
      byhour: [12,18],
      byminute: [10]
      bymonthday: [1,15,30]
    }
  }
```

### User scope

Tasks can be scheduled with a user-scope, which allows the task to run with the permissions of the user who scheduled the task. This is accomplished by creating an API key which encompasses the role and permissions of the user at the time they scheduled the task and storing this key as an encrypted field on the task document.

To schedule a task with a user scope, pass a KibanaRequest object as part of the schedule options:

```js
const task = await taskManager.schedule({
  taskType,
  runAt,
  schedule,
  params,
  scope: ['my-fanci-app'],
}, {
  request
});
```

Task Manager creates an API key using this request and stores this as an encrypted field on the task document. When the task runs, Task Manager decryptes the API key from the task document and generates a fake KibanaRequest using the decrypted API key in the authorization header. This fake request is then passed into the task runner defined in the task type

```js
createTaskRunner({ taskInstance, fakeRequest}: RunContext) {
  return {
    async run() {
      // example: use the fake request to create a scoped cluster client that queries Elasticsearch using the permissions
      // of the user who scheduled the task.
      const scopedClusterClient = elasticsearch.client.asScoped(fakeRequest);
      const results = scopedClusterClient.search({ query });
    }
  };
},
```

When the task is deleted, Task Manager automatically invalidates the associated API key.
