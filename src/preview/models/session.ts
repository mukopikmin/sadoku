export type PullRequestMetadata = {
  description: string;
  number: number;
  title: string;
  url: string;
};

export type PreviewSession = {
  pullRequest?: PullRequestMetadata;
};
