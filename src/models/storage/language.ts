import { Language } from "../api";

export const languageExtensions: { [key in Language]: string } = {
  [Language.C]: ".c",
  [Language.Java]: ".java",
};

export const languageExtensionsById: { [key: number]: string } = {
  1: ".java",
  2: ".c",
};
