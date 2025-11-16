import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory cache (expires after 30 minutes)
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

interface RedditPost {
  title: string;
  body: string;
  score: number;
  author: string;
  created_utc: number;
  permalink: string;
  subreddit: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cafeName, city } = body;

    // Generate cache key
    const cacheKey = `${cafeName}:${city}`;
    const cached = cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    // Search Reddit for mentions of the cafe
    const searchQueries = [
      `${cafeName} ${city} coffee`,
      `${cafeName} cafe ${city}`,
    ];

    const allPosts: RedditPost[] = [];

    for (const query of searchQueries) {
      try {
        // Use Reddit's JSON API (no auth needed for public posts)
        const searchUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&limit=10&sort=relevance`;

        const response = await fetch(searchUrl, {
          headers: {
            'User-Agent': 'Elsebrew/1.0',
          },
        });

        if (response.ok) {
          const data = await response.json();
          const posts = data.data?.children || [];

          posts.forEach((post: any) => {
            const postData = post.data;
            if (postData.selftext || postData.title) {
              allPosts.push({
                title: postData.title,
                body: postData.selftext || '',
                score: postData.score,
                author: postData.author,
                created_utc: postData.created_utc,
                permalink: `https://reddit.com${postData.permalink}`,
                subreddit: postData.subreddit,
              });
            }
          });
        }
      } catch (err) {
        console.error('Reddit search error:', err);
      }
    }

    // Get comments from relevant subreddits
    const subreddits = ['Coffee', 'cafe', 'espresso', 'specialty_coffee'];

    for (const subreddit of subreddits) {
      try {
        const subredditUrl = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(cafeName)}&restrict_sr=1&limit=5`;

        const response = await fetch(subredditUrl, {
          headers: {
            'User-Agent': 'Elsebrew/1.0',
          },
        });

        if (response.ok) {
          const data = await response.json();
          const posts = data.data?.children || [];

          posts.forEach((post: any) => {
            const postData = post.data;
            if (postData.selftext || postData.title) {
              allPosts.push({
                title: postData.title,
                body: postData.selftext || '',
                score: postData.score,
                author: postData.author,
                created_utc: postData.created_utc,
                permalink: `https://reddit.com${postData.permalink}`,
                subreddit: postData.subreddit,
              });
            }
          });
        }
      } catch (err) {
        console.error(`Reddit subreddit search error (${subreddit}):`, err);
      }
    }

    // Sort by score and recency
    allPosts.sort((a, b) => {
      const scoreWeight = 0.7;
      const timeWeight = 0.3;

      const aScore = (a.score * scoreWeight) + (a.created_utc * timeWeight / 1000000);
      const bScore = (b.score * scoreWeight) + (b.created_utc * timeWeight / 1000000);

      return bScore - aScore;
    });

    const result = {
      posts: allPosts.slice(0, 10), // Top 10 most relevant posts
      totalMentions: allPosts.length,
      averageScore: allPosts.length > 0
        ? allPosts.reduce((sum, post) => sum + post.score, 0) / allPosts.length
        : 0,
    };

    // Cache the result
    cache.set(cacheKey, { data: result, timestamp: Date.now() });

    // Clean old cache entries
    if (cache.size > 100) {
      const now = Date.now();
      for (const [key, value] of cache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
          cache.delete(key);
        }
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching Reddit data:', error);
    return NextResponse.json(
      { posts: [], totalMentions: 0, averageScore: 0 },
      { status: 200 } // Return empty data instead of error
    );
  }
}

export const runtime = 'nodejs';
