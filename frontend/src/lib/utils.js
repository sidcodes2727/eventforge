import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function truncate(str, length = 20) {
  if (!str) return '';
  return str.length > length ? str.substring(0, length) + '...' : str;
}

export function getStatusColor(status) {
  const colors = {
    pending: 'badge-pending',
    processing: 'badge-processing',
    processed: 'badge-processed',
    failed: 'badge-failed',
    dead: 'badge-dead',
  };
  return colors[status] || 'badge-pending';
}

export function getPriorityColor(priority) {
  const colors = {
    low: 'priority-low',
    medium: 'priority-medium',
    high: 'priority-high',
    critical: 'priority-critical',
  };
  return colors[priority] || 'priority-medium';
}

export function getEventTypeColor(type) {
  const colors = {
    'payment.success': '#22c55e',
    'payment.failed': '#ef4444',
    'order.placed': '#3b82f6',
    'order.cancelled': '#f59e0b',
    'user.signup': '#8b5cf6',
    'notification.send': '#06b6d4',
    'webhook.received': '#ec4899',
  };
  return colors[type] || '#6366f1';
}
