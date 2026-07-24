export interface BodyLimitPolicy {
  name: string;
  maxBytes: number;
}

export const SMALL_AUTH_BODY: BodyLimitPolicy = {
  name: 'small-auth-body',
  maxBytes: 16 * 1024,
};

export const NORMAL_MUTATION_BODY: BodyLimitPolicy = {
  name: 'normal-mutation-body',
  maxBytes: 256 * 1024,
};

export const LARGE_MIGRATION_BODY: BodyLimitPolicy = {
  name: 'large-migration-body',
  maxBytes: 8 * 1024 * 1024,
};

export const ASSET_UPLOAD_BODY: BodyLimitPolicy = {
  name: 'asset-upload-body',
  maxBytes: 6 * 1024 * 1024,
};

export const STORYBOARD_BASE64_BODY: BodyLimitPolicy = {
  name: 'storyboard-base64-body',
  maxBytes: 6 * 1024 * 1024,
};
