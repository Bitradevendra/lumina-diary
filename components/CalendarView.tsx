import React from 'react';
import { DiaryEntry, Reminder } from '../types';
import { Icons, MOOD_COLORS, MOOD_ICONS } from '../constants';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isAfter, startOfDay } from 'date-fns';

interface CalendarViewProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  entries: DiaryEntry[];
  reminders: Reminder[];
  onSelectDate: (date: Date) => void;
  onAddReminder: (date: Date) => void;
  tags: string[];
  selectedTag: string;
  onSelectTag: (tag: string) => void;
  searchQuery: string;
  onSearch: (query: string) => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({ 
  currentDate, 
  onDateChange, 
  entries = [], 
  reminders = [],
  onSelectDate, 
  onAddReminder,
  tags = [],
  selectedTag,
  onSelectTag,
  searchQuery,
  onSearch
}) => {
  // Safe date handling
  const validCurrentDate = currentDate instanceof Date && !isNaN(currentDate.getTime()) ? currentDate : new Date();

  const monthStart = startOfMonth(validCurrentDate);
  const monthEnd = endOfMonth(monthStart);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const today = startOfDay(new Date());

  const getEntryForDay = (day: Date) => {
    try {
      return entries.find(e => isSameDay(new Date(e.date), day));
    } catch (e) {
      console.error("Error finding entry for day", day, e);
      return undefined;
    }
  };
  
  const getRemindersForDay = (day: Date) => {
    try {
      return reminders.filter(r => isSameDay(new Date(r.date), day));
    } catch (e) {
      return [];
    }
  }

  const handleDayClick = (day: Date, isFuture: boolean) => {
      try {
        if (isFuture) {
            const message = prompt(`Set a reminder for ${format(day, 'MMM d')}?`, "Check in with myself");
            if (message) {
                (onAddReminder as any)(day, message);
            }
        } else {
            onSelectDate(day);
        }
      } catch (e) {
          console.error("Error handling day click", e);
      }
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm md:shadow-xl p-4 md:p-8 animate-fade-in flex flex-col min-h-full md:h-full">
      
      {/* Header Container */}
      <div className="flex flex-col gap-4 mb-4 md:mb-6">
        
        {/* Top Row: Title & Date Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
           <div>
             <h2 className="text-2xl md:text-3xl font-serif font-bold text-stone-800">
              {format(validCurrentDate, 'MMMM yyyy')}
            </h2>
            <p className="text-stone-400 text-xs md:text-sm font-medium mt-1">Your journey in time</p>
           </div>
           
           <div className="flex items-center gap-2 self-start sm:self-auto bg-stone-50 p-1 rounded-xl border border-stone-100">
               <input 
                  type="month"
                  value={format(validCurrentDate, 'yyyy-MM')}
                  onChange={(e) => {
                      if (e.target.value) {
                          const [year, month] = e.target.value.split('-');
                          const newDate = new Date(parseInt(year), parseInt(month) - 1, 1);
                          onDateChange(newDate);
                      }
                  }}
                  className="bg-transparent text-stone-600 text-sm font-medium px-2 py-1 outline-none cursor-pointer"
               />
               <div className="h-4 w-px bg-stone-200 mx-1"></div>
               <div className="flex gap-1">
                    <button onClick={() => onDateChange(subMonths(validCurrentDate, 1))} className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg transition-all">
                        <Icons.ChevronLeft className="w-4 h-4 text-stone-500" />
                    </button>
                    <button onClick={() => onDateChange(addMonths(validCurrentDate, 1))} className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg transition-all">
                        <Icons.ChevronRight className="w-4 h-4 text-stone-500" />
                    </button>
               </div>
           </div>
        </div>
        
        {/* Search & Filter Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative group">
                <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 px-3 py-2.5 rounded-xl text-sm font-medium text-stone-600 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                    <Icons.Search className="w-4 h-4 text-stone-400 shrink-0" />
                    <input 
                        type="text"
                        placeholder="Search memories..."
                        value={searchQuery}
                        onChange={(e) => onSearch(e.target.value)}
                        className="bg-transparent outline-none w-full placeholder:text-stone-400 min-w-0"
                    />
                </div>
            </div>

            <div className="relative group">
                <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 px-3 py-2.5 rounded-xl text-sm font-medium text-stone-600 w-full">
                    <Icons.Filter className="w-4 h-4 text-stone-400 shrink-0" />
                    <select 
                        value={selectedTag} 
                        onChange={(e) => onSelectTag(e.target.value)}
                        className="bg-transparent outline-none appearance-none w-full cursor-pointer text-stone-600 pr-6"
                    >
                        <option value="">All Tags</option>
                        {tags.map(t => <option key={t} value={t}>#{t}</option>)}
                    </select>
                    <div className="absolute right-3 pointer-events-none">
                         <Icons.ChevronLeft className="w-3 h-3 text-stone-400 -rotate-90" />
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* Days Header */}
      <div className="grid grid-cols-7 gap-1 md:gap-4 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-[10px] md:text-xs font-bold text-stone-400 uppercase tracking-wider">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 md:gap-3 lg:gap-4 auto-rows-fr">
        {days.map((day, dayIdx) => {
          const entry = getEntryForDay(day);
          const dayReminders = getRemindersForDay(day);
          const isToday = isSameDay(day, new Date());
          const isFuture = isAfter(day, today);
          
          const moodColorClass = entry ? MOOD_COLORS[entry.mood] : '';
          
          // Add padding for start of month
          const style = dayIdx === 0 ? { gridColumnStart: day.getDay() + 1 } : {};

          return (
            <button
              key={day.toString()}
              style={style}
              onClick={() => handleDayClick(day, isFuture)}
              className={`
                relative min-h-[4.5rem] md:min-h-[7rem] rounded-xl border transition-all duration-300 group
                flex flex-col items-start justify-start p-1.5 md:p-3 overflow-hidden
                ${isFuture ? 'bg-stone-50 border-stone-100 cursor-cell' : 
                  entry ? `${moodColorClass} bg-opacity-80 hover:scale-[1.02] hover:shadow-lg shadow-sm text-stone-800` :
                  isToday ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200' : 
                  'bg-white border-stone-100 hover:border-indigo-200 hover:shadow-lg'}
              `}
            >
              <div className="flex justify-between w-full z-20 relative items-start">
                  <span className={`text-xs md:text-sm font-semibold ${entry ? 'text-stone-800/70' : isToday ? 'text-indigo-600' : isFuture ? 'text-stone-300' : 'text-stone-500'}`}>
                    {format(day, 'd')}
                  </span>
                  
                  {entry ? (
                    <span className="text-sm md:text-lg leading-none filter drop-shadow-sm transform translate-x-0.5 -translate-y-0.5" title={entry.mood}>
                        {MOOD_ICONS[entry.mood]}
                    </span>
                  ) : !isFuture && dayReminders.length > 0 ? (
                      <div className="text-indigo-400">
                          <Icons.Bell className="w-3 h-3" />
                      </div>
                  ) : null}
              </div>
              
              {!isFuture && entry && (
                <div className="w-full mt-auto pt-1 relative z-10">
                   {entry.title && (
                       <span className="text-[9px] md:text-[11px] text-left text-stone-800 font-serif font-medium leading-tight line-clamp-2 w-full mix-blend-hard-light break-words">
                           {entry.title}
                       </span>
                   )}
                </div>
              )}
              
              {isFuture && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-stone-50/50 backdrop-blur-[1px]">
                    <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Set</span>
                </div>
              )}
              
              {!isFuture && !entry && (
                 <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] text-stone-300 font-bold uppercase tracking-wider">Write</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CalendarView;