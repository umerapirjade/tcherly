import React, { useState, useEffect, useRef } from "react";
import { Form, Button, Alert } from "react-bootstrap";
import { useHistory } from "react-router-dom";

import { useAuth } from "provider/auth";
import Loader from "./Loader";
import { getErrorMessage } from "handler/api";

function Courses() {
  const { request } = useAuth();
  const history = useHistory();

  const subscribed = useRef(true);

  const [course, setCourse] = useState(-1);
  const [newCourse, setNewCourse] = useState("");
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState([]);
  const [selectedType, setSelectedType] = useState("");
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    subscribed.current = true;

    return () => {
      subscribed.current = false;
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);

    request("GET", "/courses")
      .then(({ data }) => {
        if (!subscribed.current) return;
        if (data && data.success) {
          setCourses(Array.isArray(data.courses) ? data.courses : []);
        } else {
          setError("Couldn't load your courses, please refresh the page.");
        }
      })
      .catch((err) => {
        console.log(err);
        if (subscribed.current) setError(getErrorMessage(err, "Couldn't load your courses, please refresh the page."));
      })
      .finally(() => {
        if (subscribed.current) setLoading(false);
      });
  }, [request]);

  const handleChangeCourse = (e) => {
    const v = e.target.value;

    setCourse(v);
    setNewCourse("");
    setSelectedType("choose");
  };

  const handleChangeNewCourse = (e) => {
    const v = e.target.value;

    setNewCourse(v);
    setCourse("");
    setSelectedType("new");
  };

  const selectCourse = () => {
    if (course > -1) {
      const c = courses[course];

      if (c) history.push("/c/" + c._id);
    }
  };

  const createCourse = () => {
    const name = newCourse.trim();
    if (!name) {
      setError("Please select a course or enter a name for a new one.");
      return;
    }
    if (creating) return;

    setError(null);
    setCreating(true);

    request("POST", "/courses/", {
      name,
    })
      .then(({ data }) => {
        const course_id = data && data.success && data.course && data.course._id;
        if (course_id) history.push("/c/" + course_id);
        else if (subscribed.current) setError((data && data.message) || "Couldn't create the course, try again.");
      })
      .catch((err) => {
        console.log(err);
        if (subscribed.current) setError(getErrorMessage(err, "Couldn't create the course, try again."));
      })
      .finally(() => {
        if (subscribed.current) setCreating(false);
      });
  };

  const onNext = (e) => {
    e.preventDefault();

    if (selectedType === "choose") {
      selectCourse();
    } else {
      createCourse();
    }
  };

  const handleInputEnter = (e) => {
    if (e.which === 13) return createCourse();
  };

  if (loading) return <Loader />;

  return (
    <div className="card mt-5">
      <div className="card-body">
        {courses.length > 0 && (
          <>
            <Form.Group controlId="course">
              <Form.Label>Select a course</Form.Label>
              <Form.Control as="select" value={course} onChange={handleChangeCourse}>
                <option value="-1">Choose one</option>
                {courses.map((o, k) => (
                  <option key={o._id || k} value={k}>
                    {o.name}
                  </option>
                ))}
              </Form.Control>
            </Form.Group>
            <div className="text-center mb-3">OR</div>
          </>
        )}
        <Form.Group controlId="new-course">
          <Form.Label>Create a course</Form.Label>
          <Form.Control onKeyDown={handleInputEnter} placeholder="Enter a name" value={newCourse} onChange={handleChangeNewCourse} />
          <Form.Text></Form.Text>
        </Form.Group>
        {error && (
          <Alert variant="danger" className="text-center">
            {error}
          </Alert>
        )}
        <div className="text-center">
          <Button disabled={creating} onClick={onNext}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

export default Courses;
