import { NewsSource } from '../types';

export const defaultSources: NewsSource[] = [
  {
    id: 'techcrunch-ai',
    name: 'TechCrunch AI',
    url: 'https://techcrunch.com/category/artificial-intelligence/',
    type: 'website',
    category: 'Industry',
    active: true,
    selectors: {
      title: 'h2.post-block__title a',
      description: '.post-block__content',
      date: 'time.post-block__time',
      image: '.post-block__media img'
    }
  },
  {
    id: 'mit-ai',
    name: 'MIT AI News',
    url: 'https://news.mit.edu/topic/artificial-intelligence2',
    type: 'website',
    category: 'Research',
    active: true,
    selectors: {
      title: '.term-page--news-article--item--title',
      description: '.term-page--news-article--item--description',
      date: '.term-page--news-article--item--date',
      image: '.term-page--news-article--item--image img'
    }
  },
  {
    id: 'wired-ai',
    name: 'WIRED AI',
    url: 'https://www.wired.com/tag/artificial-intelligence/',
    type: 'website',
    category: 'Industry',
    active: true,
    selectors: {
      title: '.summary-item__hed',
      description: '.summary-item__dek',
      date: '.summary-item__timestamp',
      image: '.summary-item__image img'
    }
  }
];