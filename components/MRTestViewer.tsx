'use client';

import { BASE_PATH } from '../lib/assetTypes';
import { WebARSlamViewer } from './WebARSlamViewer';

const CABINET_GLB_URL = `${BASE_PATH}/3Dassets/${encodeURIComponent('Metering Cabinet-3Di.glb')}`;

/** Hidden backup prototype route (/MRTest) powered by the shared WebARSlamViewer. */
export function MRTestViewer() {
  return (
    <WebARSlamViewer
      glbUrl={CABINET_GLB_URL}
      displayName="Metering Cabinet"
      backHref="/ARs"
      backLabel="Back to Static AR"
    />
  );
}
