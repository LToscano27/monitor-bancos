import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";

Chart.register(
  ArcElement, BarElement, CategoryScale, LinearScale,
  LineElement, PointElement, Filler, Legend, Tooltip,
);

Chart.defaults.font.family = '-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
Chart.defaults.font.size = 11.5;
Chart.defaults.plugins.legend.labels.boxWidth = 12;
Chart.defaults.plugins.legend.labels.boxHeight = 12;
Chart.defaults.animation = false;
