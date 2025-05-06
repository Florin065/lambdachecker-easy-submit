import path from "path";
import { FileIcon, FolderIcon } from "../models";

/**
 * Path where the icons are located
 */
const iconFolderPath: string = path.join(
  __filename,
  "./../../../resources/icons"
);

/**
 * Define the available file icons
 */
export enum FileIconType {
  C = "C",
  Java = "Java",
}

/**
 * Map the name of the available file icons to the corresponding objects
 */
export const fileIconMapping: { [key in FileIconType]: FileIcon } = {
  [FileIconType.C]: {
    name: FileIconType.C,
    languages: ["C"],
    path: `${iconFolderPath}/c.svg`,
  },
  [FileIconType.Java]: {
    name: FileIconType.Java,
    languages: ["Java"],
    path: `${iconFolderPath}/java.svg`,
  },
};

/**
 * Define the available folder icons
 */
export enum FolderIconType {
  Cloud = "cloud",
  Local = "local",
}

/**
 * Map the name of the available folder icons to the corresponding objects
 */
export const folderIconMapping: { [key in FolderIconType]: FolderIcon } = {
  [FolderIconType.Cloud]: {
    name: FolderIconType.Cloud,
    path: `${iconFolderPath}/folder-cloud.svg`,
    openPath: `${iconFolderPath}/folder-cloud-open.svg`,
  },
  [FolderIconType.Local]: {
    name: FolderIconType.Local,
    path: `${iconFolderPath}/folder-local.svg`,
    openPath: `${iconFolderPath}/folder-local-open.svg`,
  },
};

export const defaultFolderIcon: FolderIcon =
  folderIconMapping[FolderIconType.Cloud];
