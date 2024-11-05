export interface AnalyticsData {
  views: number;
  likes: number;
  comments: number;
  subscribers: number;
  watchTime: number;
  revenue: number;
}

export interface Video {
  id: string;
  title: string;
  thumbnail: string;
  views: number;
  likes: number;
  publishDate: string;
  duration: string;
}

export interface Channel {
  id: string;
  name: string;
  subscribers: number;
  totalViews: number;
  joinDate: string;
}

export interface DashboardMetric {
  label: string;
  value: number | string;
  change: number;
  trend: 'up' | 'down' | 'neutral';
}