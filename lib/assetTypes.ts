export const BASE_PATH = '/ARInteractiveWebpage';

export type ThreeDSuffix = '-3Ds' | '-3Di';
export type ARSuffix = '-ARs' | '-ARi';
export type VR360Suffix = '-360pic' | '-360vid';
export type AssetSuffix = ThreeDSuffix | ARSuffix | VR360Suffix;

export type AssetItem = {
  id: string;
  slug: string;
  displayName: string;
  category: string;
  fileName: string;
  fileUrl: string;
  accentColor: string;
  index: number;
  isVideo?: boolean;
};
