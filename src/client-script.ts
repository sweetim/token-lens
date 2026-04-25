type ClientScriptParams = {
  dayDataJson: string;
  dailyChartDataJson: string;
  projectChartDataJson: string;
  dailyChartIdsJson: string;
  sharedDailyChartDayDataJson: string;
  projectChartDataSetsJson: string;
  defaultTabIsDaily: boolean;
};

function getDataScript(params: ClientScriptParams): string {
  const data = {
    dayData: JSON.parse(params.dayDataJson),
    dailyCharts: JSON.parse(params.dailyChartDataJson),
    projectCharts: JSON.parse(params.projectChartDataJson),
    dailyChartIds: JSON.parse(params.dailyChartIdsJson),
    dailyChartData: JSON.parse(params.sharedDailyChartDayDataJson),
    projectChartDataSets: JSON.parse(params.projectChartDataSetsJson),
    defaultTabIsDaily: params.defaultTabIsDaily,
  };
  return `window.__TOKEN_LENS_DATA__ = ${JSON.stringify(data)};`;
}

export { getDataScript };
export type { ClientScriptParams };
