import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Heart, MessageCircle, Send, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Post {
  id: string;
  title: string;
  content: string;
  user_id: string;
  author: string;
  is_anonymous: boolean;
  likes_count: number;
  created_at: string;
  hasLiked: boolean;
}

export const FeedTab: React.FC = () => {
  const { user, isAuthenticated, generateAnonymousName, profile } = useAuth();
  const { toast } = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState({ title: '', content: '', isAnonymous: true });

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (postsError) throw postsError;

      const { data: likesData, error: likesError } = await supabase
        .from('post_likes')
        .select('post_id')
        .eq('user_id', user?.id || '');

      if (likesError && user) throw likesError;

      const likedPostIds = new Set(likesData?.map(like => like.post_id) || []);

      const postsWithLikes = await Promise.all(
        postsData.map(async (post) => {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('username')
            .eq('user_id', post.user_id)
            .single();

          return {
            ...post,
            author: post.is_anonymous 
              ? generateAnonymousName('feed', 'general')
              : profileData?.username || 'Unknown User',
            hasLiked: likedPostIds.has(post.id)
          };
        })
      );

      setPosts(postsWithLikes);
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast({ title: 'Error', description: 'Failed to load posts.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async () => {
    if (!isAuthenticated || !user) {
      toast({ title: 'Please login', description: 'You need to be logged in to create posts.' });
      return;
    }

    if (!newPost.title.trim() || !newPost.content.trim()) {
      toast({ title: 'Missing content', description: 'Please fill in both title and content.' });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('posts')
        .insert({
          title: newPost.title,
          content: newPost.content,
          user_id: user.id,
          is_anonymous: newPost.isAnonymous
        })
        .select()
        .single();

      if (error) throw error;

      const newPostWithAuthor = {
        ...data,
        author: newPost.isAnonymous 
          ? generateAnonymousName('feed', 'general') 
          : profile?.username || 'Unknown User',
        hasLiked: false
      };

      setPosts([newPostWithAuthor, ...posts]);
      setNewPost({ title: '', content: '', isAnonymous: true });
      toast({ title: 'Post created!', description: 'Your post has been shared with the community.' });
    } catch (error) {
      console.error('Error creating post:', error);
      toast({ title: 'Error', description: 'Failed to create post.' });
    }
  };

  const handleLike = async (postId: string) => {
    if (!isAuthenticated || !user) {
      toast({ title: 'Please login', description: 'You need to be logged in to like posts.' });
      return;
    }

    const post = posts.find(p => p.id === postId);
    if (!post) return;

    try {
      if (post.hasLiked) {
        // Unlike
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);

        await supabase
          .from('posts')
          .update({ likes_count: post.likes_count - 1 })
          .eq('id', postId);
      } else {
        // Like
        await supabase
          .from('post_likes')
          .insert({ post_id: postId, user_id: user.id });

        await supabase
          .from('posts')
          .update({ likes_count: post.likes_count + 1 })
          .eq('id', postId);
      }

      setPosts(posts.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            likes_count: post.hasLiked ? p.likes_count - 1 : p.likes_count + 1,
            hasLiked: !p.hasLiked
          };
        }
        return p;
      }));
    } catch (error) {
      console.error('Error updating like:', error);
      toast({ title: 'Error', description: 'Failed to update like.' });
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return '1 day ago';
    return `${diffDays} days ago`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="bg-gradient-card shadow-card">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Loading posts...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Create Post Section */}
      <Card className="bg-gradient-card shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-accent" />
            Share with the Community
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Post title..."
            value={newPost.title}
            onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
          />
          <Textarea
            placeholder="What's on your mind? Share your thoughts, experiences, or questions..."
            value={newPost.content}
            onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
            className="min-h-[100px]"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Switch
                id="anonymous"
                checked={newPost.isAnonymous}
                onCheckedChange={(checked) => setNewPost({ ...newPost, isAnonymous: checked })}
              />
              <Label htmlFor="anonymous" className="text-sm">
                Post anonymously {newPost.isAnonymous && isAuthenticated && 
                  `(as ${generateAnonymousName('feed', 'general')})`}
              </Label>
            </div>
            <Button onClick={handleCreatePost} variant="accent">
              Post
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Posts Feed */}
      <div className="space-y-4">
        {posts.map((post) => (
          <Card key={post.id} className="bg-gradient-card shadow-card hover:shadow-elegant transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{post.title}</CardTitle>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <Users className="w-4 h-4" />
                    <span>{post.author}</span>
                    <span>•</span>
                    <span>{formatTimeAgo(post.created_at)}</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-foreground leading-relaxed mb-4">{post.content}</p>
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleLike(post.id)}
                  className={`flex items-center gap-2 ${post.hasLiked ? 'text-accent' : ''}`}
                >
                  <Heart className={`w-4 h-4 ${post.hasLiked ? 'fill-current' : ''}`} />
                  {post.likes_count}
                </Button>
                <Button variant="ghost" size="sm" className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4" />
                  Comment
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {posts.length === 0 && (
        <Card className="bg-gradient-card shadow-card">
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No posts yet</h3>
            <p className="text-muted-foreground">Be the first to share something with the community!</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};