import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useTime } from '../state/time';

/** Deep time is part of the main timeline; this address just opens the map on that stretch. */
export default function DeepTime() {
  const { setDeep } = useTime();
  useEffect(() => setDeep(true), [setDeep]);
  return <Navigate to="/" replace />;
}
