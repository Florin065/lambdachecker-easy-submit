export interface FileIcon {
  /**
   * Name of the icon, e.g. "c"
   */
  name: string;

  /**
   * Programming languages that this icon is associated with
   */
  languages: string[];

  /**
   * Path to the icon, e.g. "resources/icons/c.svg"
   */
  path: string;
}
