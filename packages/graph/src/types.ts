export type TopicId = string;

/** `topicId` requires `prerequisiteId` to be learned first. */
export interface Edge {
  readonly topicId: TopicId;
  readonly prerequisiteId: TopicId;
}
