import React from 'react';
import { ThumbsUp, MessageCircle, AlertCircle, Smile, Frown, Meh } from 'lucide-react';

const comments = [
  {
    id: '1',
    text: 'This tutorial was exactly what I needed! Very clear explanations.',
    author: 'Sarah Johnson',
    likes: 245,
    sentiment: 'positive',
    timestamp: '2 hours ago',
  },
  {
    id: '2',
    text: 'Could you explain the middleware section in more detail?',
    author: 'Mike Chen',
    likes: 123,
    sentiment: 'neutral',
    timestamp: '5 hours ago',
  },
];

const sentimentStats = {
  positive: 75,
  neutral: 20,
  negative: 5,
};

export function CommentAnalysis() {
  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return <Smile className="w-4 h-4 text-green-500" />;
      case 'negative':
        return <Frown className="w-4 h-4 text-red-500" />;
      default:
        return <Meh className="w-4 h-4 text-yellow-500" />;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Comment Analysis</h2>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-green-700">Positive</span>
              <Smile className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-2xl font-semibold text-green-700">{sentimentStats.positive}%</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-yellow-700">Neutral</span>
              <Meh className="w-5 h-5 text-yellow-500" />
            </div>
            <p className="text-2xl font-semibold text-yellow-700">{sentimentStats.neutral}%</p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-red-700">Negative</span>
              <Frown className="w-5 h-5 text-red-500" />
            </div>
            <p className="text-2xl font-semibold text-red-700">{sentimentStats.negative}%</p>
          </div>
        </div>
        
        <div className="space-y-4">
          {comments.map((comment) => (
            <div key={comment.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-gray-900">{comment.author}</span>
                    <span className="text-gray-500">•</span>
                    <span className="text-sm text-gray-500">{comment.timestamp}</span>
                  </div>
                  <p className="mt-1 text-gray-600">{comment.text}</p>
                  <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                    <div className="flex items-center">
                      <ThumbsUp className="w-4 h-4 mr-1" />
                      {comment.likes}
                    </div>
                    <div className="flex items-center">
                      {getSentimentIcon(comment.sentiment)}
                      <span className="ml-1 capitalize">{comment.sentiment}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}