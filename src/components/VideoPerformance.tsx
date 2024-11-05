import React from 'react';
import { Play, ThumbsUp, MessageCircle, Clock } from 'lucide-react';

const videos = [
  {
    id: '1',
    title: 'How to Build a React App in 10 Minutes',
    thumbnail: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=350&h=200&fit=crop',
    views: 245000,
    likes: 15000,
    comments: 832,
    duration: '10:32',
    publishDate: '2024-02-15',
  },
  {
    id: '2',
    title: 'TypeScript Tutorial for Beginners',
    thumbnail: 'https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=350&h=200&fit=crop',
    views: 180000,
    likes: 12000,
    comments: 645,
    duration: '15:45',
    publishDate: '2024-02-10',
  },
];

export function VideoPerformance() {
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Top Performing Videos</h2>
      </div>
      <div className="divide-y divide-gray-200">
        {videos.map((video) => (
          <div key={video.id} className="p-6 hover:bg-gray-50">
            <div className="flex space-x-4">
              <div className="relative flex-shrink-0">
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="w-48 h-28 object-cover rounded-lg"
                />
                <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 px-2 py-1 rounded text-white text-xs flex items-center">
                  <Clock className="w-3 h-3 mr-1" />
                  {video.duration}
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-gray-900 line-clamp-2">
                  {video.title}
                </h3>
                <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                  <div className="flex items-center">
                    <Play className="w-4 h-4 mr-1" />
                    {video.views.toLocaleString()} views
                  </div>
                  <div className="flex items-center">
                    <ThumbsUp className="w-4 h-4 mr-1" />
                    {video.likes.toLocaleString()}
                  </div>
                  <div className="flex items-center">
                    <MessageCircle className="w-4 h-4 mr-1" />
                    {video.comments.toLocaleString()}
                  </div>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  Published on {new Date(video.publishDate).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}