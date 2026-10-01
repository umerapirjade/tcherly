import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button, Card, Badge, Alert } from "react-bootstrap";
import { ProvideStudentAuth, useStudentAuth } from "provider/student-auth";
import StudentAuth from "components/student-auth";
import Loader from "components/Loader";
import api from "handler/api";

function CourseList() {
  const { data: student, request, logout } = useStudentAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState(null);
  const [joinSuccess, setJoinSuccess] = useState(null);

  const loadCourses = () => {
    setLoading(true);
    request("GET", "/student/courses")
      .then(({ data }) => {
        if (data && data.success) setCourses(data.courses || []);
        else setError("Could not load courses.");
      })
      .catch(() => setError("Could not load courses."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadCourses(); }, [request]);

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoining(true);
    setJoinError(null);
    setJoinSuccess(null);
    try {
      const { data } = await request("POST", "/student/join", { join_code: joinCode.trim() });
      if (data && data.success) {
        setJoinSuccess(data.already_enrolled ? `You are already enrolled in "${data.course.name}".` : `Joined "${data.course.name}" successfully!`);
        setJoinCode("");
        loadCourses();
      } else {
        setJoinError((data && data.message) || "Could not join. Check the code and try again.");
      }
    } catch (err) {
      const msg = err && err.response && err.response.data && err.response.data.message;
      setJoinError(msg || "Invalid join code. Please check and try again.");
    } finally {
      setJoining(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  if (loading) return <Loader label="Loading courses..." />;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8f9fa" }}>
      {/* Header */}
      <div style={{ backgroundColor: "#fff", borderBottom: "1px solid #dee2e6", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "1.25rem", fontWeight: 600, color: "#343a40" }}>Student Dashboard</span>
          <Badge variant="secondary" style={{ fontSize: "0.75rem" }}>
            {student && student.name ? student.name : student && student.email}
          </Badge>
        </div>
        <Button variant="outline-secondary" size="sm" onClick={handleLogout}>
          Logout
        </Button>
      </div>

      <div className="container py-4">
        {/* Join a course */}
        <div className="mb-4 p-3" style={{ background: "#fff", border: "1px solid #dee2e6", borderRadius: 8 }}>
          <h6 className="mb-2" style={{ fontWeight: 600 }}>Join a Course</h6>
          <p className="text-muted mb-2" style={{ fontSize: "0.85rem" }}>Ask your teacher for the 6-character join code and enter it below.</p>
          <form onSubmit={handleJoin} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              value={joinCode}
              onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setJoinError(null); setJoinSuccess(null); }}
              placeholder="e.g. AB3X7K"
              maxLength={6}
              style={{ fontFamily: "monospace", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", width: 140, padding: "6px 12px", border: "1px solid #ced4da", borderRadius: 4, fontSize: "1rem" }}
            />
            <Button type="submit" variant="primary" size="sm" disabled={joining || !joinCode.trim()}>
              {joining ? "Joining…" : "Join"}
            </Button>
          </form>
          {joinError && <p className="mt-2 mb-0 text-danger" style={{ fontSize: "0.83rem" }}>{joinError}</p>}
          {joinSuccess && <p className="mt-2 mb-0 text-success" style={{ fontSize: "0.83rem" }}>{joinSuccess}</p>}
        </div>

        <h5 className="mb-3" style={{ color: "#495057" }}>My Courses</h5>

        {error && <Alert variant="danger">{error}</Alert>}

        {!error && courses.length === 0 && (
          <div className="text-center py-5">
            <div style={{ fontSize: "3rem", marginBottom: "16px" }}>📚</div>
            <h5 className="text-muted">No courses yet</h5>
            <p className="text-muted" style={{ maxWidth: 400, margin: "0 auto" }}>
              You are not enrolled in any courses yet. Open a lesson link shared by your teacher to get started — you will be automatically enrolled in that course.
            </p>
          </div>
        )}

        <div className="row">
          {courses.map((course) => (
            <div key={course._id} className="col-sm-6 col-lg-4 mb-4">
              <Card className="h-100 shadow-sm" style={{ borderRadius: 8 }}>
                <Card.Body className="d-flex flex-column">
                  <Card.Title style={{ fontSize: "1rem", fontWeight: 600 }}>{course.name}</Card.Title>
                  <p className="text-muted mb-3" style={{ fontSize: "0.85rem" }}>
                    {course.lessons ? course.lessons.length : 0} lecture{course.lessons && course.lessons.length !== 1 ? "s" : ""}
                  </p>
                  <div className="mt-auto">
                    <Link to={`/student/courses/${course._id}`}>
                      <Button variant="primary" size="sm" block>
                        View Lectures
                      </Button>
                    </Link>
                  </div>
                </Card.Body>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StudentDashboardInner() {
  const { isLoggedIn, loading, refresh } = useStudentAuth();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    refresh()
      .catch(() => {})
      .finally(() => setChecked(true));
  }, []);

  if (!checked || loading) return <Loader />;
  if (!isLoggedIn) return <StudentAuth />;
  return <CourseList />;
}

export default function StudentDashboardPage() {
  return (
    <ProvideStudentAuth>
      <StudentDashboardInner />
    </ProvideStudentAuth>
  );
}
