import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

export default function EChart({ option, height = 300, style }) {
  const ref = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    chartRef.current = echarts.init(ref.current);
    const onResize = () => chartRef.current?.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      chartRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    if (option) chartRef.current?.setOption(option, true);
  }, [option]);

  return <div ref={ref} style={{ width: '100%', height, ...style }} />;
}
