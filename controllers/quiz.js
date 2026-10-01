const QuizQuestion = require("../database/models/quiz-question");
const QuizAnswer   = require("../database/models/quiz-answer");
const Lesson = require("../database/models/lesson");
const { isValidObjectId, sendError } = require("../handlers/misc");

const findLesson = (id) =>
  isValidObjectId(id)
    ? Lesson.findOne({ _id: id })
    : Lesson.findOne({ id });

const findOwnedLesson = (id, userId) =>
  isValidObjectId(id)
    ? Lesson.findOne({ _id: id, user: userId })
    : Lesson.findOne({ id, user: userId });

const VALID_TYPES = ["mcq", "msq", "true_false"];

// ── Teacher: list questions ──────────────────────────────────────────────────

const getQuizQuestions = async (req, res) => {
  try {
    const lesson = await findOwnedLesson(req.params.id, req.user._id);
    if (!lesson) return res.status(404).send({ success: false, message: "Lesson not found." });

    const questions = await QuizQuestion.find({ lesson: lesson._id }).sort({ timestamp: 1 });
    return res.json({ success: true, questions });
  } catch (err) {
    return sendError(res, err);
  }
};

// ── Teacher: create question ─────────────────────────────────────────────────

const createQuizQuestion = async (req, res) => {
  try {
    const lesson = await findOwnedLesson(req.params.id, req.user._id);
    if (!lesson) return res.status(404).send({ success: false, message: "Lesson not found." });

    const { question, type, options, timestamp } = req.body;

    if (!question || !type || timestamp === undefined || timestamp === null) {
      return res.status(400).send({ success: false, message: "question, type and timestamp are required." });
    }
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).send({ success: false, message: "Invalid type. Use mcq, msq or true_false." });
    }

    const finalOptions = type === "true_false"
      ? [
          { text: "True",  isCorrect: !!(options && options[0] && options[0].isCorrect) },
          { text: "False", isCorrect: !!(options && options[1] && options[1].isCorrect) },
        ]
      : (Array.isArray(options) ? options : []);

    const newQ = await new QuizQuestion({
      lesson: lesson._id,
      question,
      type,
      options: finalOptions,
      timestamp: Number(timestamp),
      created_by: req.user._id,
    }).save();

    return res.status(201).json({ success: true, question: newQ });
  } catch (err) {
    return sendError(res, err);
  }
};

// ── Teacher: update question ─────────────────────────────────────────────────

const updateQuizQuestion = async (req, res) => {
  try {
    const lesson = await findOwnedLesson(req.params.id, req.user._id);
    if (!lesson) return res.status(404).send({ success: false, message: "Lesson not found." });

    const existing = await QuizQuestion.findOne({ _id: req.params.qid, lesson: lesson._id });
    if (!existing) return res.status(404).send({ success: false, message: "Question not found." });

    const { question, type, options, timestamp } = req.body;

    if (question  !== undefined) existing.question  = question;
    if (timestamp !== undefined) existing.timestamp = Number(timestamp);
    if (type      !== undefined) {
      if (!VALID_TYPES.includes(type)) return res.status(400).send({ success: false, message: "Invalid type." });
      existing.type = type;
    }
    if (options !== undefined) {
      existing.options = existing.type === "true_false"
        ? [
            { text: "True",  isCorrect: !!(options[0] && options[0].isCorrect) },
            { text: "False", isCorrect: !!(options[1] && options[1].isCorrect) },
          ]
        : options;
    }

    await existing.save();
    return res.json({ success: true, question: existing });
  } catch (err) {
    return sendError(res, err);
  }
};

// ── Teacher: delete question ─────────────────────────────────────────────────

const deleteQuizQuestion = async (req, res) => {
  try {
    const lesson = await findOwnedLesson(req.params.id, req.user._id);
    if (!lesson) return res.status(404).send({ success: false, message: "Lesson not found." });

    const deleted = await QuizQuestion.findOneAndDelete({ _id: req.params.qid, lesson: lesson._id });
    if (!deleted) return res.status(404).send({ success: false, message: "Question not found." });

    return res.json({ success: true });
  } catch (err) {
    return sendError(res, err);
  }
};

// ── Student: list questions (no isCorrect) ───────────────────────────────────

const getStudentQuizQuestions = async (req, res) => {
  try {
    const lesson = await findLesson(req.params.lesson_id);
    if (!lesson) return res.status(404).send({ success: false, message: "Lesson not found." });

    const questions = await QuizQuestion.find({ lesson: lesson._id })
      .sort({ timestamp: 1 })
      .lean();

    // Strip isCorrect so students can't cheat by reading the API response
    const safe = questions.map((q) => ({
      ...q,
      options: q.options.map(({ _id, text }) => ({ _id, text })),
    }));

    return res.json({ success: true, questions: safe });
  } catch (err) {
    return sendError(res, err);
  }
};

// ── Student: submit answer ───────────────────────────────────────────────────

const submitQuizAnswer = async (req, res) => {
  try {
    const question = await QuizQuestion.findById(req.params.qid);
    if (!question) return res.status(404).send({ success: false, message: "Question not found." });

    const { answer } = req.body; // single option _id (mcq/tf) or array of _ids (msq)
    let correct = false;

    if (question.type === "mcq" || question.type === "true_false") {
      const opt = question.options.id(answer);
      correct = !!(opt && opt.isCorrect);
    } else if (question.type === "msq") {
      const selected = (Array.isArray(answer) ? answer : [answer]).map(String);
      const correctIds = question.options.filter((o) => o.isCorrect).map((o) => String(o._id));
      correct =
        correctIds.length > 0 &&
        correctIds.length === selected.length &&
        correctIds.every((id) => selected.includes(id));
    }

    // Save the answer for analytics
    await QuizAnswer.create({
      question: question._id,
      lesson:   question.lesson,
      student:  req.user._id,
      correct,
    });

    return res.json({ success: true, correct });
  } catch (err) {
    return sendError(res, err);
  }
};

// ── Teacher: quiz analysis ────────────────────────────────────────────────────

const getQuizAnalysis = async (req, res) => {
  try {
    const lesson = await findOwnedLesson(req.params.id, req.user._id);
    if (!lesson) return res.status(404).send({ success: false, message: "Lesson not found." });

    const questions = await QuizQuestion.find({ lesson: lesson._id }).sort({ timestamp: 1 }).lean();
    if (!questions.length) return res.json({ success: true, scoring: "first_try", questions: [], summary: { total_questions: 0, total_students: 0, opened: (lesson.watched || []).length, total_attempts: 0, correct: 0, wrong: 0 } });

    const qIds = questions.map((q) => q._id);

    const answers = await QuizAnswer.aggregate([
      { $match: { question: { $in: qIds } } },
      { $group: { _id: { question: "$question", correct: "$correct" }, count: { $sum: 1 } } },
    ]);

    const statsMap = {};
    for (const row of answers) {
      const key = String(row._id.question);
      if (!statsMap[key]) statsMap[key] = { correct: 0, wrong: 0 };
      if (row._id.correct) statsMap[key].correct += row.count;
      else statsMap[key].wrong += row.count;
    }

    // Per student and question: was the earliest answer correct, and was any answer correct?
    // Retries create extra QuizAnswer documents, so these student-level numbers are the honest ones.
    const perStudent = await QuizAnswer.aggregate([
      { $match: { question: { $in: qIds } } },
      { $sort: { createdAt: 1, _id: 1 } },
      {
        $group: {
          _id: { question: "$question", student: "$student" },
          first: { $first: "$correct" },
          any: { $max: "$correct" },
        },
      },
      {
        $group: {
          _id: "$_id.question",
          answered: { $sum: 1 },
          first_correct: { $sum: { $cond: ["$first", 1, 0] } },
          best_correct: { $sum: { $cond: ["$any", 1, 0] } },
        },
      },
    ]);
    const studentStats = {};
    for (const row of perStudent) studentStats[String(row._id)] = row;

    const uniqueStudents = await QuizAnswer.distinct("student", { lesson: lesson._id });

    const result = questions.map((q) => {
      const s = statsMap[String(q._id)] || { correct: 0, wrong: 0 };
      const st = studentStats[String(q._id)] || { answered: 0, first_correct: 0, best_correct: 0 };
      return {
        _id: q._id,
        question: q.question,
        type: q.type,
        timestamp: q.timestamp,
        options_count: (q.options || []).length,
        correct: s.correct,
        wrong: s.wrong,
        total: s.correct + s.wrong,
        answered: st.answered,
        first_correct: st.first_correct,
        best_correct: st.best_correct,
      };
    });

    const totalCorrect = result.reduce((s, q) => s + q.correct, 0);
    const totalWrong   = result.reduce((s, q) => s + q.wrong,   0);

    return res.json({
      success: true,
      scoring: "first_try",
      questions: result,
      summary: {
        total_questions: questions.length,
        total_students:  uniqueStudents.length,
        opened:          (lesson.watched || []).length,
        total_attempts:  totalCorrect + totalWrong,
        correct:         totalCorrect,
        wrong:           totalWrong,
      },
    });
  } catch (err) {
    return sendError(res, err);
  }
};

module.exports = {
  getQuizQuestions,
  createQuizQuestion,
  updateQuizQuestion,
  deleteQuizQuestion,
  getStudentQuizQuestions,
  submitQuizAnswer,
  getQuizAnalysis,
};
