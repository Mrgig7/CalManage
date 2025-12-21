import { useState, useEffect, useCallback } from 'react';
import { Plus, Circle, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const TasksPage = () => {
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState('');
  const [loading, setLoading] = useState(true);
  const { token } = useAuth();

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
        body: JSON.stringify({ text: newTask }),
      });
      const data = await res.json();
      
      if (res.ok) {
        setTasks([data, ...tasks]);
        setNewTask('');
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
        // Revert if failed (omitted for brevity)
    }
  };

  const deleteTask = async (id) => {
      try {
        const res = await fetch(`http://localhost:5000/api/tasks/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
            setTasks(tasks.filter(task => task._id !== id));
        }
      } catch (error) {
          console.error(error);
      }
  };

  if (loading) return <div className="p-8">Loading tasks...</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Add Task Input */}
        <form onSubmit={addTask} className="p-4 border-b border-gray-100 flex items-center gap-4">
          <Plus className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            className="flex-1 bg-transparent border-none focus:ring-0 placeholder-gray-400 text-gray-700"
            placeholder="Add a task..."
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
          />
          <button 
            type="submit"
            disabled={!newTask.trim()}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add Task
          </button>
        </form>

        {/* Task List */}
        <div className="divide-y divide-gray-100">
          {tasks.length > 0 ? (
            tasks.map(task => (
              <div key={task._id} className="p-4 flex items-center group hover:bg-gray-50 transition-colors">
                <button 
                  onClick={() => toggleTask(task._id, task.completed)}
                  className={`flex-shrink-0 mr-4 ${task.completed ? 'text-green-500' : 'text-gray-300 hover:text-gray-400'}`}
                >
                  {task.completed ? (
                    <CheckCircle className="w-6 h-6" />
                  ) : (
                    <Circle className="w-6 h-6" />
                  )}
                </button>
                <span className={`flex-1 text-sm ${task.completed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                  {task.text}
                </span>
                <button 
                    onClick={() => deleteTask(task._id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 text-sm font-medium px-2 py-1"
                >
                    Delete
                </button>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-gray-500">
              No tasks yet. Add one above!
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TasksPage;
