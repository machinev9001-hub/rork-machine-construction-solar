import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

type TaskHeaderProps = {
  siteName: string;
  userId: string;
  taskCount: number;
  currentIndex: number;
  onPrevious: () => void;
  onNext: () => void;
  backgroundColor: string;
};

export const TaskHeader = React.memo<TaskHeaderProps>(({
  siteName,
  userId,
  taskCount,
  currentIndex,
  onPrevious,
  onNext,
  backgroundColor,
}) => {
  const isFirstTask = currentIndex === 0;
  const isLastTask = currentIndex === taskCount - 1;

  return (
    <View style={[styles.headerCard, { backgroundColor }]}>
      <View style={styles.headerLeftContent}>
        <Text style={styles.siteName}>{siteName.toUpperCase()}</Text>
        {taskCount > 1 && (
          <View style={styles.carouselNav}>
            <TouchableOpacity 
              style={[styles.carouselButton, isFirstTask && styles.carouselButtonDisabled]}
              onPress={onPrevious}
              disabled={isFirstTask}
            >
              <ChevronLeft size={20} color={isFirstTask ? '#94a3b8' : '#fff'} />
            </TouchableOpacity>
            <Text style={styles.carouselText}>
              Task {currentIndex + 1} of {taskCount}
            </Text>
            <TouchableOpacity 
              style={[styles.carouselButton, isLastTask && styles.carouselButtonDisabled]}
              onPress={onNext}
              disabled={isLastTask}
            >
              <ChevronRight size={20} color={isLastTask ? '#94a3b8' : '#fff'} />
            </TouchableOpacity>
          </View>
        )}
      </View>
      <View style={styles.userBadge}>
        <Text style={styles.userBadgeText}>👤 {userId}</Text>
      </View>
    </View>
  );
});

TaskHeader.displayName = 'TaskHeader';

const styles = StyleSheet.create({
  headerCard: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  headerLeftContent: {
    flex: 1,
  },
  siteName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  carouselNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  carouselButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  carouselButtonDisabled: {
    opacity: 0.4,
  },
  carouselText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.3,
  },
  userBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  userBadgeText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
});
