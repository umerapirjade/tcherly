const router = require("express").Router();
const { studentVerifyMiddleware } = require("../middleware/auth");
const { joinCourseLimiter } = require("../middleware/rate-limit");
const { getEnrolledCourses, getEnrolledCourseLessons, joinCourse } = require("../controllers/student-course");
const { getStudentQuizQuestions, submitQuizAnswer } = require("../controllers/quiz");

router.get("/courses", studentVerifyMiddleware, getEnrolledCourses);
router.get("/courses/:id", studentVerifyMiddleware, getEnrolledCourseLessons);
router.post("/join", studentVerifyMiddleware, joinCourseLimiter(), joinCourse);

// Quiz (student)
router.get("/quiz/:lesson_id",   studentVerifyMiddleware, getStudentQuizQuestions);
router.post("/quiz/:qid/answer", studentVerifyMiddleware, submitQuizAnswer);

module.exports = router;
