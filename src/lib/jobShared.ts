export type JobStatusKey = "confirmed" | "on_the_way" | "arrived" | "completed" | "cancelled";

export const JOB_STEPS: JobStatusKey[] = ["confirmed", "on_the_way", "arrived", "completed"];

export const JOB_LABEL: Record<JobStatusKey, string> = {
  confirmed: "Confirmed",
  on_the_way: "On the way",
  arrived: "Arrived",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** The only allowed move from each status. */
export const NEXT_STATUS: Partial<Record<JobStatusKey, JobStatusKey>> = {
  confirmed: "on_the_way",
  on_the_way: "arrived",
  arrived: "completed",
};

export const NEXT_BUTTON: Partial<Record<JobStatusKey, string>> = {
  confirmed: "I'm on my way",
  on_the_way: "I've arrived",
  arrived: "Mark as completed",
};

/** Chat notice the customer sees when the job reaches a status. */
export const STATUS_NOTICE: Partial<Record<JobStatusKey, string>> = {
  on_the_way: "Your technician is on the way.",
  arrived: "Your technician has arrived.",
  completed: "The job is marked as completed. Thank you for using Crafteey.",
};