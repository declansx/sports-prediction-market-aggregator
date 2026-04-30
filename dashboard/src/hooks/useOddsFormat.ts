import { useEffect, useState } from 'react';
import { getOddsFormat, setOddsFormat, subscribeOddsFormat, type OddsFormat } from '../lib/oddsFormat';

export function useOddsFormat(): [OddsFormat, (f: OddsFormat) => void] {
  const [format, setFormat] = useState<OddsFormat>(getOddsFormat);
  useEffect(() => subscribeOddsFormat(setFormat), []);
  return [format, setOddsFormat];
}
