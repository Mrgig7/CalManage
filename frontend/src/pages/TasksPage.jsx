import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Plus, 
  Circle, 
  CheckCircle, 
  Trash2, 
  Calendar as CalendarIcon, 
  Flag, 
  Filter,
  Loader2,
  ListTodo,
  CheckSquare,
  Clock,
  Sparkles,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import GlassPanel from '../components/UI/GlassPanel';

const PRIORITY_CONFIG = {
  high: { label: 'High', color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30', icon: '🔴' },
  medium: { label: 'Medium', color: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/30', icon: '🟡' },
  low: { label: 'Low', color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/30', icon: '🔵' },
  none: { label: 'None', color: 'text-gray-400', bg: 'bg-gray-500/20', border: 'border-gray-500/30', icon: '⚪' }
};

const TasksPage = () => {
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState('');
  const [newPriority, setNewPriority] = useState('none');
  const [newDueDate, setNewDueDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'active', 'completed'
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showAddOptions, setShowAddOptions] = useState(false);
  const { token } = useAuth();

  const FILTER_OPTIONS = [
    { value: 'all', label: 'All Tasks', icon: '📋' },
    { value: 'active', label: 'Active', icon: '⏳' },
    { value: 'completed', label: 'Completed', icon: '✅' }
  ];

  const fetchTasks = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('http://localhost:5000/api/tasks', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setTasks(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const addTask = async (e) => {
    e.preventDefault();
    if (!newTask.trim()) return;

    try {
      const res = await fetch('http://localhost:5000/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          text: newTask,
          priority: newPriority,
          dueDate: newDueDate || null
        }),
      });
      const data = await res.json();
      
      if (res.ok) {
        setTasks([data, ...tasks]);
        setNewTask('');
        setNewPriority('none');
        setNewDueDate('');
        setShowAddOptions(false);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const toggleTask = async (id, completed) => {
    // Optimistic update
    setTasks(tasks.map(task => 
      task._id === id ? { ...task, completed: !completed } : task
    ));

    try {
      await fetch(`http://localhost:5000/api/tasks/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ completed: !completed }),
      });
    } catch (error) {
      console.error(error);
      // Revert on error
      setTasks(tasks.map(task => 
        task._id === id ? { ...task, completed } : task
      ));
    }
  };

  const deleteTask = async (id) => {
    // Optimistic update
    const previousTasks = tasks;
    setTasks(tasks.filter(task => task._id !== id));

    try {
      const res = await fetch(`http://localhost:5000/api/tasks/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setTasks(previousTasks);
      }
    } catch (error) {
      console.error(error);
      setTasks(previousTasks);
    }
  };

  // Filter and sort tasks
  const filteredTasks = useMemo(() => {
    let result = [...tasks];
    
    // Apply filter
    if (filter === 'active') {
      result = result.filter(t => !t.completed);
    } else if (filter === 'completed') {
      result = result.filter(t => t.completed);
    }
    
    // Sort: uncompleted first, then by priority, then by due date
    const priorityOrder = { high: 0, medium: 1, low: 2, none: 3 };
    result.sort((a, b) => {
      // Completed tasks go to the bottom
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      // Then by priority
      const priorityDiff = (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3);
      if (priorityDiff !== 0) return priorityDiff;
      // Then by due date (earliest first, no date last)
      if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return 0;
    });
    
    return result;
  }, [tasks, filter]);

  // Stats
  const stats = useMemo(() => ({
    total: tasks.length,
    completed: tasks.filter(t => t.completed).length,
    active: tasks.filter(t => !t.completed).length,
    overdue: tasks.filter(t => !t.completed && t.dueDate && isPast(parseISO(t.dueDate))).length
  }), [tasks]);

  const formatDueDate = (dateStr) => {
    if (!dateStr) return null;
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    if (isPast(date)) return `Overdue: ${format(date, 'MMM d')}`;
    return format(date, 'MMM d');
  };

  const getDueDateStyle = (dateStr, completed) => {
    if (completed || !dateStr) return 'text-gray-500';
    const date = parseISO(dateStr);
    if (isPast(date)) return 'text-red-400';
    if (isToday(date)) return 'text-amber-400';
    if (isTomorrow(date)) return 'text-blue-400';
    return 'text-gray-400';
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlassPanel className="p-4 flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-xl">
            <ListTodo className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{stats.total}</p>
            <p className="text-xs text-gray-500">Total Tasks</p>
          </div>
        </GlassPanel>
        
        <GlassPanel className="p-4 flex items-center gap-3">
          <div className="p-2 bg-amber-500/20 rounded-xl">
            <Clock className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{stats.active}</p>
            <p className="text-xs text-gray-500">In Progress</p>
          </div>
        </GlassPanel>
        
        <GlassPanel className="p-4 flex items-center gap-3">
          <div className="p-2 bg-green-500/20 rounded-xl">
            <CheckSquare className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{stats.completed}</p>
            <p className="text-xs text-gray-500">Completed</p>
          </div>
        </GlassPanel>
        
        <GlassPanel className="p-4 flex items-center gap-3">
          <div className="p-2 bg-red-500/20 rounded-xl">
            <Flag className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{stats.overdue}</p>
            <p className="text-xs text-gray-500">Overdue</p>
          </div>
        </GlassPanel>
      </div>

      {/* Main Task Panel */}
      <GlassPanel className="overflow-hidden">
        {/* Header with Filter */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h2 className="font-semibold text-white">My Tasks</h2>
          </div>
          
          <div className="relative">
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 hover:bg-white/10 transition-all"
            >
              <Filter className="w-4 h-4 text-gray-500" />
              <span>{FILTER_OPTIONS.find(f => f.value === filter)?.label}</span>
              <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showFilterDropdown ? 'rotate-180' : ''}`} />
            </button>
            
            <AnimatePresence>
              {showFilterDropdown && (
                <>
                  {/* Backdrop to close dropdown */}
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowFilterDropdown(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-44 bg-dark-bg/95 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden z-50 shadow-2xl shadow-black/50"
                  >
                    {FILTER_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setFilter(option.value);
                          setShowFilterDropdown(false);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all ${
                          filter === option.value 
                            ? 'bg-blue-500/20 text-blue-400' 
                            : 'text-gray-300 hover:bg-white/10'
                        }`}
                      >
                        <span>{option.icon}</span>
                        <span>{option.label}</span>
                        {filter === option.value && (
                          <svg className="w-4 h-4 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Add Task Form */}
        <form onSubmit={addTask} className="p-4 border-b border-white/5 bg-white/5">
          <div className="flex items-center gap-4">
            <Plus className="w-5 h-5 text-gray-500 flex-shrink-0" />
            <input
              type="text"
              className="flex-1 bg-transparent border-none focus:ring-0 placeholder-gray-500 text-white text-sm"
              placeholder="What needs to be done?"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onFocus={() => setShowAddOptions(true)}
            />
            <motion.button 
              type="submit"
              disabled={!newTask.trim()}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-medium rounded-lg hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20 transition-all"
            >
              Add Task
            </motion.button>
          </div>
          
          {/* Additional Options */}
          <AnimatePresence>
            {showAddOptions && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/5">
                  {/* Priority Selector */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowPriorityDropdown(!showPriorityDropdown)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-all ${PRIORITY_CONFIG[newPriority].border} ${PRIORITY_CONFIG[newPriority].bg}`}
                    >
                      <Flag className={`w-4 h-4 ${PRIORITY_CONFIG[newPriority].color}`} />
                      <span className={PRIORITY_CONFIG[newPriority].color}>{PRIORITY_CONFIG[newPriority].label}</span>
                      <ChevronDown className="w-3 h-3 text-gray-400" />
                    </button>
                    
                    <AnimatePresence>
                      {showPriorityDropdown && (
                        <>
                          {/* Backdrop to close dropdown */}
                          <div 
                            className="fixed inset-0 z-40" 
                            onClick={() => setShowPriorityDropdown(false)}
                          />
                          <motion.div 
                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="absolute top-full left-0 mt-2 w-40 bg-dark-bg/95 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden z-50 shadow-2xl shadow-black/50"
                          >
                            {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                              <button
                                key={key}
                                type="button"
                                onClick={() => {
                                  setNewPriority(key);
                                  setShowPriorityDropdown(false);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all ${
                                  newPriority === key 
                                    ? `${config.bg} ${config.color}` 
                                    : `text-gray-300 hover:bg-white/10`
                                }`}
                              >
                                <span>{config.icon}</span>
                                <span>{config.label}</span>
                                {newPriority === key && (
                                  <svg className="w-4 h-4 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </button>
                            ))}
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                  
                  {/* Due Date Picker */}
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-gray-500" />
                    <input
                      type="date"
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500/50 [color-scheme:dark]"
                    />
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => setShowAddOptions(false)}
                    className="ml-auto text-xs text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    Hide options
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </form>

        {/* Task List */}
        <div className="divide-y divide-white/5">
          {filteredTasks.length > 0 ? (
            <AnimatePresence>
              {filteredTasks.map((task, index) => (
                <motion.div 
                  key={task._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: index * 0.03 }}
                  className={`p-4 flex items-center group hover:bg-white/5 transition-all ${task.completed ? 'opacity-60' : ''}`}
                >
                  <button 
                    onClick={() => toggleTask(task._id, task.completed)}
                    className={`flex-shrink-0 mr-4 transition-transform hover:scale-110 ${task.completed ? 'text-green-500' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    <motion.div whileTap={{ scale: 0.8 }}>
                      {task.completed ? (
                        <CheckCircle className="w-6 h-6" />
                      ) : (
                        <Circle className="w-6 h-6" />
                      )}
                    </motion.div>
                  </button>
                  
                  <div className="flex-1 min-w-0">
                    <span className={`block text-sm truncate ${task.completed ? 'text-gray-500 line-through' : 'text-gray-200'}`}>
                      {task.text}
                    </span>
                    
                    {/* Task metadata */}
                    <div className="flex items-center gap-3 mt-1">
                      {task.priority && task.priority !== 'none' && (
                        <span className={`text-xs ${PRIORITY_CONFIG[task.priority]?.color || 'text-gray-500'}`}>
                          {PRIORITY_CONFIG[task.priority]?.icon} {PRIORITY_CONFIG[task.priority]?.label}
                        </span>
                      )}
                      {task.dueDate && (
                        <span className={`text-xs flex items-center gap-1 ${getDueDateStyle(task.dueDate, task.completed)}`}>
                          <CalendarIcon className="w-3 h-3" />
                          {formatDueDate(task.dueDate)}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <motion.button 
                    onClick={() => deleteTask(task._id)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </motion.button>
                </motion.div>
              ))}
            </AnimatePresence>
          ) : (
            <div className="p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
                <CheckSquare className="w-8 h-8 text-indigo-400" />
              </div>
              <p className="text-gray-400 font-medium">
                {filter === 'completed' ? 'No completed tasks yet' : 
                 filter === 'active' ? 'All caught up!' : 
                 'No tasks yet'}
              </p>
              <p className="text-gray-600 text-sm mt-1">
                {filter === 'all' && 'Add a task above to get started'}
              </p>
            </div>
          )}
        </div>
        
        {/* Footer with progress */}
        {tasks.length > 0 && (
          <div className="p-4 border-t border-white/5 bg-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">Progress</span>
              <span className="text-xs text-gray-400">
                {stats.completed} of {stats.total} completed
              </span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: stats.total > 0 ? `${(stats.completed / stats.total) * 100}%` : '0%' }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full"
              />
            </div>
          </div>
        )}
      </GlassPanel>
    </div>
  );
};

export default TasksPage;
