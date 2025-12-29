import { useState, useEffect } from 'react';
import { X, Heart, MessageCircle, Bookmark, Send, Loader2, Crown, Calendar, FileText, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Article } from '@/types';
import { cn } from '@/lib/utils';
import { useArticles } from '@/hooks/use-articles';

interface Comment {
  id: string;
  body: string;
  created_at: string;
  author?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    username: string | null;
    avatar_url: string | null;
    is_premium: boolean | null;
  } | null;
}

interface ArticleDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: Article | null;
}

export function ArticleDetailModal({
  isOpen,
  onClose,
  article,
}: ArticleDetailModalProps) {
  const [comment, setComment] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isLoadingState, setIsLoadingState] = useState(false);

  const { toggleLike, toggleFavorite, addComment, getArticleState } = useArticles();

  useEffect(() => {
    if (isOpen && article) {
      setLikesCount(article.likes_count || 0);
      setFavoritesCount(article.favorites_count || 0);
      setIsLiked(false);
      setIsFavorited(false);
      setComments([]);
      
      // Load article state
      setIsLoadingState(true);
      getArticleState(article.id).then((state) => {
        setIsLiked(state.isLiked);
        setIsFavorited(state.isFavorited);
        setComments(state.comments || []);
        setIsLoadingState(false);
      });
    }
  }, [isOpen, article, getArticleState]);

  if (!isOpen || !article) return null;

  const handleLike = async () => {
    const result = await toggleLike(article.id);
    if (result) {
      setIsLiked(result.isLiked);
      setLikesCount(result.likesCount);
    }
  };

  const handleFavorite = async () => {
    const result = await toggleFavorite(article.id);
    if (result) {
      setIsFavorited(result.isFavorited);
      setFavoritesCount(result.favoritesCount);
    }
  };

  const handleSubmitComment = async () => {
    if (!comment.trim()) return;
    setIsSubmittingComment(true);
    const result = await addComment(article.id, comment);
    if (result?.comment) {
      setComments([...comments, result.comment]);
      setComment('');
    }
    setIsSubmittingComment(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatCommentDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/95 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="absolute inset-x-0 top-0 bottom-0 flex flex-col bg-card animate-fade-in md:inset-4 md:rounded-2xl">
        {/* Header - shows title */}
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-card p-4">
          <h2 className="font-heading text-lg font-semibold line-clamp-1">
            {article.title}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          {/* Author Section */}
          {article.author && !article.is_anonymous && (
            <div className="border-b border-border p-4">
              <div className="flex items-center gap-3">
                <img
                  src={article.author.avatar_url || '/placeholder.svg'}
                  alt={article.author.first_name}
                  className="h-12 w-12 rounded-full object-cover ring-2 ring-primary/20"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {article.author.first_name} {article.author.last_name}
                    </span>
                    {article.author.is_premium && (
                      <Crown className="h-4 w-4 text-yellow-500" />
                    )}
                  </div>
                  {article.author.username && (
                    <p className="text-sm text-muted-foreground">@{article.author.username}</p>
                  )}
                </div>
              </div>
              
              {/* Author Stats */}
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5" />
                  <span>{article.author.reputation || 0} репутации</span>
                </div>
                <div className="flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  <span>{article.author.articles_count || 0} статей</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>С {formatDate(article.author.created_at)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Anonymous Author */}
          {article.is_anonymous && (
            <div className="border-b border-border p-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-xl">👤</span>
                </div>
                <div>
                  <span className="font-medium">Аноним</span>
                  <p className="text-sm text-muted-foreground">Автор скрыл свою личность</p>
                </div>
              </div>
            </div>
          )}

          {/* Media */}
          {article.media_url && (
            <div className="p-4">
              {article.media_type === 'youtube' ? (
                <div className="relative aspect-video rounded-xl overflow-hidden bg-muted">
                  <iframe
                    src={`https://www.youtube.com/embed/${article.media_url}`}
                    className="absolute inset-0 h-full w-full"
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  />
                </div>
              ) : (
                <img
                  src={article.media_url}
                  alt={article.title}
                  className="w-full rounded-xl object-cover max-h-80"
                />
              )}
            </div>
          )}

          {/* Article Body */}
          <div className="p-4">
            {/* Topic label if exists */}
            {article.topic && (
              <p className="text-sm text-muted-foreground mb-2">{article.topic}</p>
            )}
            {/* Title above body in larger white font */}
            <h1 className="font-heading text-xl font-bold text-foreground mb-4">
              {article.title}
            </h1>
            <div className="prose prose-sm max-w-none text-foreground">
              <p className="whitespace-pre-wrap">{article.body}</p>
            </div>

            {/* Sources */}
            {article.sources && article.sources.length > 0 && (
              <div className="mt-6 rounded-xl bg-secondary/50 p-4">
                <h4 className="mb-2 text-sm font-medium">Источники:</h4>
                <ul className="space-y-1">
                  {article.sources.map((source, i) => (
                    <li key={i} className="text-sm text-primary hover:underline">
                      <a href={source} target="_blank" rel="noopener noreferrer">
                        {source}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Article Meta */}
            <div className="mt-4 text-xs text-muted-foreground">
              <span>Опубликовано {formatDate(article.created_at)}</span>
            </div>
          </div>

          {/* Comments Section */}
          {comments.length > 0 && (
            <div className="border-t border-border p-4">
              <h3 className="text-sm font-medium mb-3">Комментарии ({comments.length})</h3>
              <div className="space-y-3">
                {comments.map((c) => (
                  <div key={c.id} className="flex gap-3">
                    <img
                      src={c.author?.avatar_url || '/placeholder.svg'}
                      alt=""
                      className="h-8 w-8 rounded-full object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {c.author?.first_name || 'Пользователь'}
                        </span>
                        {c.author?.is_premium && (
                          <Crown className="h-3 w-3 text-yellow-500" />
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatCommentDate(c.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-foreground mt-0.5">{c.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Bar */}
          <div className="sticky bottom-0 border-t border-border bg-card p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleLike}
                  disabled={isLoadingState}
                  className={cn(
                    'flex items-center gap-1.5 transition-colors',
                    isLiked ? 'text-red-500' : 'text-muted-foreground hover:text-red-500'
                  )}
                >
                  <Heart className={cn('h-6 w-6', isLiked && 'fill-current')} />
                  <span className="text-sm font-medium">{likesCount}</span>
                </button>
                <button className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors">
                  <MessageCircle className="h-6 w-6" />
                  <span className="text-sm font-medium">{comments.length}</span>
                </button>
              </div>
              <button
                onClick={handleFavorite}
                disabled={isLoadingState}
                className={cn(
                  'transition-colors',
                  isFavorited ? 'text-primary' : 'text-muted-foreground hover:text-primary'
                )}
              >
                <Bookmark className={cn('h-6 w-6', isFavorited && 'fill-current')} />
              </button>
            </div>

            {/* Comment Input */}
            {article.allow_comments !== false && (
              <div className="flex gap-2">
                <Input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Написать комментарий..."
                  className="flex-1"
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmitComment()}
                />
                <Button
                  size="icon"
                  onClick={handleSubmitComment}
                  disabled={!comment.trim() || isSubmittingComment}
                >
                  {isSubmittingComment ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
