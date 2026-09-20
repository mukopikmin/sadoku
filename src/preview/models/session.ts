export type PullRequestMetadata = {
  description: string;
  title: string;
  url: string;
};

export type PreviewSession = {
  pullRequest?: PullRequestMetadata;
};
