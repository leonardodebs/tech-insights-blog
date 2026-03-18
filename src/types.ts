export interface Post {
  id: string;
  title: string;
  date: string;
  excerpt: string;
  content: string;
  tags: string[];
  category: string;
}

export interface RSSFeed {
  title: string;
  link: string;
  contentSnippet: string;
  isoDate: string;
}
