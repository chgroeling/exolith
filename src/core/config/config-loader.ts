import type { ConfigLoadResult } from './config-types';

/** Searches for and parses the exolith configuration file via bubble-up search. */
export interface ConfigLoaderService {
  /**
   * Searches upward from `cwd` for {@link CONFIG_FILE_NAME}. The first matching
   * directory becomes the exolith root. All subsequent paths are resolved
   * relative to this root.
   * @param cwd Starting directory for the bubble-up search.
   * @returns The parsed configuration and the discovered root directory.
   * @throws If {@link CONFIG_FILE_NAME} is not found up to the filesystem boundary,
   *         or if the found file contains malformed JSON5.
   */
  load(cwd: string): Promise<ConfigLoadResult>;
}
