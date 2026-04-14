export interface Lesson {
  title: string;
  content: string;
  summary: string;
}

export interface Module {
  title: string;
  lessons: Lesson[];
}

export interface Flashcard {
  question: string;
  answer: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correct_answer: string;
}

export interface Course {
  course_title: string;
  modules: Module[];
  flashcards: Flashcard[];
  quiz: QuizQuestion[];
  highlights: string[];
  final_insights: string;
}
