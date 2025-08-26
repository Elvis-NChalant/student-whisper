import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  rating: number;
  onRatingChange?: (rating: number) => void;
  size?: 'sm' | 'md' | 'lg';
  readonly?: boolean;
  className?: string;
}

export const StarRating: React.FC<StarRatingProps> = ({
  rating,
  onRatingChange,
  size = 'md',
  readonly = false,
  className
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  const handleStarClick = (starIndex: number) => {
    if (!readonly && onRatingChange) {
      onRatingChange(starIndex + 1);
    }
  };

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {[...Array(5)].map((_, index) => (
        <button
          key={index}
          type="button"
          onClick={() => handleStarClick(index)}
          disabled={readonly}
          className={cn(
            sizeClasses[size],
            'transition-colors duration-200',
            !readonly && 'hover:scale-110 transition-transform',
            readonly && 'cursor-default'
          )}
        >
          <Star
            className={cn(
              'w-full h-full transition-colors duration-200',
              index < rating
                ? 'fill-accent text-accent'
                : 'text-muted-foreground hover:text-accent'
            )}
          />
        </button>
      ))}
      <span className="ml-2 text-sm text-muted-foreground">
        {rating}/5
      </span>
    </div>
  );
};