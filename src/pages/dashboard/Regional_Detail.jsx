import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import Sidebar from '../../components/Sidebar';

const RegionalDetails = () => {
  // ---- Sidebar state ----
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  // ---- Chart refs ----
  const lineChartRef = useRef(null);
  const radarChartRef = useRef(null);
  const barChartRef = useRef(null);
  const lineChartInstance = useRef(null);
  const radarChartInstance = useRef(null);
  const barChartInstance = useRef(null);

  // ---- Sample data ----
  const years = ['2022', '2023', '2024', '2025', '2026'];
  const resilienceScores = [35.3, 50, 47, 60, 64.7];
  const currentScore = 64.7;
  const trend = '+4.3';

  const regionScores = [
    { name: 'Brunei', score: 23.3 },
    { name: 'Kalimantan', score: 14.3 },
    { name: 'Sabah', score: 27.9 },
    { name: 'Sarawak', score: 34.6 },
  ];

  // ---- True Wealth Hexagon data ----
  const pillarData = {
    Food: 61,
    Shelter: 66,
    Healthcare: 66,
    Entertainment: 71,
    Education: 58,
  };
  const pillarNames = Object.keys(pillarData);
  const pillarValues = Object.values(pillarData);

  // ---- Bar chart data (Food: Crop Production & Agricultural Land) ----
  const barYears = ['2022', '2023', '2024', '2025', '2026'];
  const cropProduction = [2.28, 2.44, 2.35, 2.64, 2.57]; // in millions
  const agriculturalLand = [0.758, 0.590, 0.756, 0.717, 0.714]; // in millions

  // ---- Light theme colors ----
  const theme = {
    primary: '#22c55e',
    borderLight: '#e5e7eb',
    textMuted: '#6b7280',
    bgSurface: '#ffffff',
    azure: '#3b82f6',
    yellow: '#eab308',
    purple: '#a855f7',
    pink: '#ec4899',
  };

  // ---- Initialize Line Chart ----
  useEffect(() => {
    if (!lineChartRef.current) return;
    lineChartInstance.current = echarts.init(lineChartRef.current);

    const option = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { color: theme.borderLight } },
        formatter: function (params) {
          const p = params[0];
          return `<strong>${p.axisValue}</strong><br/>Resilience: ${p.value}%`;
        },
      },
      grid: {
        left: '5%',
        right: '5%',
        bottom: '10%',
        top: '10%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: years,
        boundaryGap: false,
        axisLine: { lineStyle: { color: theme.borderLight } },
        axisTick: { show: false },
        axisLabel: { color: theme.textMuted, fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        splitLine: {
          lineStyle: { color: theme.borderLight, type: 'dashed' },
        },
        axisLabel: {
          color: theme.textMuted,
          fontSize: 10,
          formatter: '{value}%',
        },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          name: 'Resilience Score',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          showSymbol: true,
          data: resilienceScores,
          lineStyle: { color: theme.primary, width: 2.5 },
          itemStyle: {
            color: theme.primary,
            borderColor: theme.bgSurface,
            borderWidth: 2,
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: theme.primary + '44' },
              { offset: 1, color: theme.primary + '00' },
            ]),
          },
        },
      ],
    };

    lineChartInstance.current.setOption(option);

    const handleResize = () => {
      lineChartInstance.current?.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      lineChartInstance.current?.dispose();
    };
  }, []);

  // ---- Initialize Radar Chart (True Wealth Hexagon) ----
  useEffect(() => {
    if (!radarChartRef.current) return;
    radarChartInstance.current = echarts.init(radarChartRef.current);

    const option = {
      tooltip: {
        trigger: 'item',
        formatter: function (params) {
          return `<strong>${params.name}</strong><br/>Score: ${params.value}`;
        },
      },
      radar: {
        indicator: pillarNames.map((name) => ({ name, max: 100 })),
        center: ['50%', '50%'],
        radius: '70%',
        axisName: {
          color: '#374151',
          fontSize: 12,
          fontWeight: 500,
        },
        splitArea: {
          areaStyle: {
            color: ['rgba(34, 197, 94, 0.02)', 'rgba(34, 197, 94, 0.02)'],
          },
        },
        axisLine: {
          lineStyle: {
            color: '#e5e7eb',
          },
        },
        splitLine: {
          lineStyle: {
            color: '#e5e7eb',
          },
        },
      },
      series: [
        {
          type: 'radar',
          data: [
            {
              value: pillarValues,
              name: 'True Wealth',
              areaStyle: {
                color: 'rgba(34, 197, 94, 0.3)',
              },
              lineStyle: {
                color: '#22c55e',
                width: 2,
              },
              itemStyle: {
                color: '#22c55e',
              },
            },
          ],
        },
      ],
    };

    radarChartInstance.current.setOption(option);

    const handleResize = () => {
      radarChartInstance.current?.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      radarChartInstance.current?.dispose();
    };
  }, []);

  // ---- Initialize Bar Chart (Food: Crop Production & Agricultural Land) ----
  useEffect(() => {
    if (!barChartRef.current) return;
    barChartInstance.current = echarts.init(barChartRef.current);

    const option = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: function (params) {
          let html = `<strong>${params[0].axisValue}</strong><br/>`;
          params.forEach((p) => {
            html += `${p.marker} ${p.seriesName}: ${p.value}M<br/>`;
          });
          return html;
        },
      },
      grid: {
        left: '8%',
        right: '5%',
        bottom: '10%',
        top: '10%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: barYears,
        axisLine: { lineStyle: { color: theme.borderLight } },
        axisTick: { show: false },
        axisLabel: { color: theme.textMuted, fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        splitLine: {
          lineStyle: { color: theme.borderLight, type: 'dashed' },
        },
        axisLabel: {
          color: theme.textMuted,
          fontSize: 10,
          formatter: '{value}M',
        },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      legend: {
        data: ['Crop production (paddy)', 'Agricultural land'],
        bottom: 0,
        left: 'center',
        icon: 'circle',
        textStyle: {
          color: '#374151',
          fontSize: 11,
        },
        itemWidth: 10,
        itemHeight: 10,
      },
      series: [
        {
          name: 'Crop production (paddy)',
          type: 'bar',
          barWidth: '28%',
          data: cropProduction,
          itemStyle: {
            color: '#22c55e',
            borderRadius: [4, 4, 0, 0],
          },
          label: {
            show: true,
            position: 'top',
            formatter: '{c}M',
            fontSize: 10,
            color: '#6b7280',
          },
        },
        {
          name: 'Agricultural land',
          type: 'bar',
          barWidth: '28%',
          data: agriculturalLand,
          itemStyle: {
            color: '#3b82f6',
            borderRadius: [4, 4, 0, 0],
          },
          label: {
            show: true,
            position: 'top',
            formatter: '{c}M',
            fontSize: 10,
            color: '#6b7280',
          },
        },
      ],
    };

    barChartInstance.current.setOption(option);

    const handleResize = () => {
      barChartInstance.current?.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      barChartInstance.current?.dispose();
    };
  }, []);

  return (
    <div style={styles.container}>
      {/* ---- Sidebar ---- */}
      <div
        style={{
          ...styles.sidebarWrapper,
          width: isSidebarOpen ? '240px' : '0px',
          minWidth: isSidebarOpen ? '240px' : '0px',
        }}
      >
        <Sidebar />
      </div>

      {/* ---- Main content ---- */}
      <div style={styles.content}>
        {/* Floating toggle button */}
        <button onClick={toggleSidebar} style={styles.floatingBtn} className="floating-btn">
          ☰
        </button>

        {/* ---- Row 1: Two-column (Line + Radar) ---- */}
        <div style={styles.chartRow}>
          {/* Left: Line Chart */}
          <div style={styles.card}>
            <div style={styles.chartHeader}>
              <div style={styles.chartHeaderLeft}>
                <div style={styles.cardTitle}>Overall Resilience Trend</div>
                <div style={styles.chartStat}>
                  {currentScore}%{' '}
                  <span style={{ fontSize: '13px', fontWeight: 500, color: '#22c55e' }}>
                    ↑ {trend}%
                  </span>
                </div>
                <div style={{ fontSize: '11.5px', color: '#6b7280' }}>
                  Current resilience score (Borneo)
                </div>
              </div>
              <div style={styles.chartTabs}>
                <button style={{ ...styles.chartTab, ...styles.chartTabActive }}>5 years</button>
              </div>
            </div>
            <div style={styles.chartArea}>
              <div ref={lineChartRef} style={{ width: '100%', height: '100%' }} />
            </div>
            <div style={styles.cardFooter}>
              <span style={styles.footerLabel}>Regional scores:</span>
              {regionScores.map((r) => (
                <span key={r.name} style={styles.footerItem}>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: theme.primary,
                      display: 'inline-block',
                    }}
                  />
                  {r.name}: <strong>{r.score}%</strong>
                </span>
              ))}
            </div>
          </div>

          {/* Right: Radar Chart */}
          <div style={styles.card}>
            <div style={styles.chartHeader}>
              <div style={styles.chartHeaderLeft}>
                <div style={styles.cardTitle}>True Wealth Hexagon</div>
                <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
                  Pillar Performance
                </div>
              </div>
              <div style={styles.chartTabs}>
                <button style={{ ...styles.chartTab, ...styles.chartTabActive }}>Current</button>
              </div>
            </div>
            <div style={styles.chartArea}>
              <div ref={radarChartRef} style={{ width: '100%', height: '100%' }} />
            </div>
            <div style={styles.cardFooter}>
              {pillarNames.map((name, idx) => (
                <span key={name} style={styles.footerItem}>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: ['#22c55e', '#3b82f6', '#eab308', '#a855f7', '#ec4899'][idx % 5],
                      display: 'inline-block',
                    }}
                  />
                  {name}: <strong>{pillarValues[idx]}</strong>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ---- Row 2: Full-width Bar Chart (Food) ---- */}
        <div style={styles.barRow}>
          <div style={{ ...styles.card, width: '100%' }}>
            <div style={styles.chartHeader}>
              <div style={styles.chartHeaderLeft}>
                <div style={styles.cardTitle}>Food</div>
                <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
                  Crop production &amp; Agricultural land (millions)
                </div>
              </div>
              <div style={styles.chartTabs}>
                <button style={{ ...styles.chartTab, ...styles.chartTabActive }}>5 years</button>
              </div>
            </div>
            <div style={{ ...styles.chartArea, height: '280px' }}>
              <div ref={barChartRef} style={{ width: '100%', height: '100%' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---- Light mode styles ----
const styles = {
  container: {
    display: 'flex',
    height: '100vh',
    width: '100%',
    backgroundColor: '#f3f4f6',
    fontFamily: 'Arial, sans-serif',
    overflow: 'hidden',
  },
  sidebarWrapper: {
    overflow: 'hidden',
    transition: 'width 0.3s ease, min-width 0.3s ease',
    flexShrink: 0,
    height: '100%',
  },
  content: {
    flex: 1,
    padding: '24px',
    overflowY: 'auto',
    position: 'relative',
  },
  floatingBtn: {
    position: 'absolute',
    top: '16px',
    left: '16px',
    zIndex: 1001,
    backgroundColor: '#ffffff',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '24px',
    padding: '6px 12px',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    color: '#1f2937',
    transition: 'background 0.2s, box-shadow 0.2s',
    lineHeight: 1,
  },
  chartRow: {
    display: 'flex',
    gap: '20px',
    marginTop: '50px',
    flexWrap: 'wrap',
  },
  barRow: {
    marginTop: '20px',
    width: '97%',
  },
  card: {
    flex: 1,
    minWidth: '300px',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '20px 20px 16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 20px rgba(0,0,0,0.05)',
    border: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
  },
  chartHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px',
  },
  chartHeaderLeft: {
    flex: 1,
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: '2px',
  },
  chartStat: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1f2937',
    marginTop: '4px',
  },
  chartTabs: {
    display: 'flex',
    gap: '4px',
    background: '#f3f4f6',
    padding: '4px',
    borderRadius: '8px',
  },
  chartTab: {
    background: 'transparent',
    border: 'none',
    padding: '6px 14px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '500',
    color: '#6b7280',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  chartTabActive: {
    background: '#ffffff',
    color: '#1f2937',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  },
  chartArea: {
    width: '100%',
    height: '240px',
    marginTop: '4px',
    flexShrink: 0,
  },
  cardFooter: {
    marginTop: '16px',
    paddingTop: '14px',
    borderTop: '1px solid #e5e7eb',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px',
    fontSize: '13px',
    color: '#6b7280',
  },
  footerLabel: {
    fontWeight: '500',
    color: '#374151',
    marginRight: '4px',
  },
  footerItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
};

export default RegionalDetails;