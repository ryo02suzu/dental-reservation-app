import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, addDays, subDays } from "date-fns";
import { ja } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AppointmentModal } from "@/components/appointment-modal";

interface Patient { id: string; name: string; patientNumber: string; cancellationCount: number; noShowCount: number; recallIntervalMonths?: number }
interface Staff { id: string; name: string; role: string }
interface Appointment {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  confirmationStatus: string;
  treatmentType: string;
  chairNumber?: number;
  notes?: string;
  staffId?: string;
  serviceId?: string;
  patientId: string;
  patient?: Patient;
  staff?: Staff;
}

const START_HOUR = 9;
const END_HOUR = 19;
const SLOT_MINUTES = 30;
const SLOT_HEIGHT = 48;
const TOTAL_SLOTS = ((END_HOUR - START_HOUR) * 60) / SLOT_MINUTES;
const MAX_CHAIRS = 6;

const treatmentColors: Record<string, string> = {
  定期検診: "bg-blue-100 border-l-4 border-blue-400 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200",
  虫歯治療: "bg-red-100 border-l-4 border-red-400 text-red-900 dark:bg-red-900/40 dark:text-red-200",
  クリーニング: "bg-green-100 border-l-4 border-green-400 text-green-900 dark:bg-green-900/40 dark:text-green-200",
  矯正相談: "bg-purple-100 border-l-4 border-purple-400 text-purple-900 dark:bg-purple-900/40 dark:text-purple-200",
  抜歯: "bg-orange-100 border-l-4 border-orange-400 text-orange-900 dark:bg-orange-900/40 dark:text-orange-200",
  根管治療: "bg-pink-100 border-l-4 border-pink-400 text-pink-900 dark:bg-pink-900/40 dark:text-pink-200",
};

function timeToSlot(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return ((h - START_HOUR) * 60 + m) / SLOT_MINUTES;
}

function slotToTime(slot: number): string {
  const totalMin = START_HOUR * 60 + slot * SLOT_MINUTES;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function ChairTimeline() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [initialSlotData, setInitialSlotData] = useState<{ date: string; time: string; chairNumber?: number } | null>(null);

  const dateStr = format(currentDate, "yyyy-MM-dd");

  const { data: appointments = [], isLoading } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments", dateStr],
    queryFn: () => fetch(`/api/appointments?date=${dateStr}`).then(r => r.json()),
  });

  const activeAppts = appointments.filter(a => a.status !== "cancelled" && a.chairNumber);

  const usedChairs = Array.from(new Set(activeAppts.map(a => a.chairNumber!))).sort((a, b) => a - b);
  const chairs = usedChairs.length > 0 ? Array.from({ length: Math.max(...usedChairs, 3) }, (_, i) => i + 1) : [1, 2, 3];

  const handleSlotClick = (chair: number, slot: number) => {
    setSelectedAppointment(null);
    setInitialSlotData({ date: dateStr, time: slotToTime(slot), chairNumber: chair });
    setIsModalOpen(true);
  };

  const handleApptClick = (appt: Appointment) => {
    setSelectedAppointment(appt);
    setInitialSlotData(null);
    setIsModalOpen(true);
  };

  const isToday = dateStr === format(new Date(), "yyyy-MM-dd");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(d => subDays(d, 1))} data-testid="chair-prev-day">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center min-w-[160px]">
            <div className={`text-sm font-semibold ${isToday ? "text-primary" : ""}`}>
              {format(currentDate, "M月d日（E）", { locale: ja })}
              {isToday && <span className="ml-1.5 text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">今日</span>}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(d => addDays(d, 1))} data-testid="chair-next-day">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>{START_HOUR}:00 〜 {END_HOUR}:00</span>
          <span className="text-muted-foreground/50">|</span>
          <span>ユニット数: {chairs.length}</span>
        </div>
      </div>

      {/* Timeline grid */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : (
          <div className="flex min-w-max">
            {/* Time axis */}
            <div className="shrink-0 w-14 border-r border-border bg-muted/30 sticky left-0 z-10">
              <div className="h-10 border-b border-border bg-muted/40" />
              {Array.from({ length: TOTAL_SLOTS }, (_, i) => (
                <div
                  key={i}
                  style={{ height: SLOT_HEIGHT }}
                  className={`flex items-start justify-end pr-2 pt-1 text-xs text-muted-foreground border-b border-border/40 ${i % 2 === 0 ? "font-medium" : "opacity-50"}`}
                >
                  {i % 2 === 0 ? slotToTime(i) : ""}
                </div>
              ))}
            </div>

            {/* Chair columns */}
            {chairs.map(chair => {
              const chairAppts = activeAppts.filter(a => a.chairNumber === chair);
              return (
                <div key={chair} className="relative border-r border-border" style={{ minWidth: 160, flex: 1 }}>
                  {/* Chair header */}
                  <div className="h-10 border-b border-border bg-muted/40 flex items-center justify-center sticky top-0 z-10">
                    <span className="text-xs font-semibold text-muted-foreground">ユニット {chair}</span>
                  </div>

                  {/* Slot grid (background) */}
                  {Array.from({ length: TOTAL_SLOTS }, (_, i) => (
                    <div
                      key={i}
                      style={{ height: SLOT_HEIGHT }}
                      className={`border-b border-border/30 cursor-pointer hover:bg-primary/5 transition-colors ${i % 2 === 0 ? "" : "bg-muted/10"}`}
                      onClick={() => handleSlotClick(chair, i)}
                      data-testid={`chair-slot-${chair}-${i}`}
                    />
                  ))}

                  {/* Appointments overlay */}
                  {chairAppts.map(appt => {
                    const startSlot = timeToSlot(appt.startTime);
                    const endSlot = timeToSlot(appt.endTime);
                    const top = startSlot * SLOT_HEIGHT + 40;
                    const height = Math.max((endSlot - startSlot) * SLOT_HEIGHT - 2, SLOT_HEIGHT - 2);
                    const colorClass = treatmentColors[appt.treatmentType] || "bg-gray-100 border-l-4 border-gray-400 text-gray-900 dark:bg-gray-800 dark:text-gray-200";

                    return (
                      <div
                        key={appt.id}
                        className={`absolute inset-x-1 rounded-sm cursor-pointer overflow-hidden shadow-sm hover:shadow-md transition-shadow ${colorClass}`}
                        style={{ top, height }}
                        onClick={() => handleApptClick(appt)}
                        data-testid={`chair-appt-${appt.id}`}
                      >
                        <div className="p-1.5 h-full flex flex-col justify-start">
                          <div className="font-semibold text-xs leading-tight truncate">
                            {appt.patient?.name || "不明"}
                          </div>
                          {height >= 50 && (
                            <div className="text-xs opacity-75 truncate mt-0.5">
                              {appt.treatmentType}
                            </div>
                          )}
                          {height >= 72 && appt.staff && (
                            <div className="text-xs opacity-60 truncate">
                              {appt.staff.name}
                            </div>
                          )}
                          {height >= 90 && (
                            <div className="text-xs opacity-60 mt-auto">
                              {appt.startTime.slice(0, 5)}〜{appt.endTime.slice(0, 5)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AppointmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        appointment={selectedAppointment as any}
        initialSlotData={initialSlotData ? { date: initialSlotData.date, time: initialSlotData.time } : null}
        onSaved={() => {}}
      />
    </div>
  );
}
