defmodule GolfStatsServerWeb.CourseController do
  use GolfStatsServerWeb, :controller
  require Logger

  alias GolfStatsServer.Courses
  alias GolfStatsServer.Courses.Course

  action_fallback(GolfStatsServerWeb.FallbackController)

  def index(conn, %{"q" => query}) do
    courses = Courses.search_courses(query)
    render(conn, :index, courses: courses)
  end

  def index(conn, %{"filter" => "mine"}) do
    user = conn.assigns.current_user
    courses = Courses.list_user_courses(user)
    render(conn, :index, courses: courses)
  end

  def index(conn, _params) do
    courses = Courses.list_courses()
    render(conn, :index, courses: courses)
  end

  def create(conn, %{"course" => course_params}) do
    user = conn.assigns.current_user
    course_params = Map.put(course_params, "user_id", user.id)

    Logger.info("Creating course with params: #{inspect(course_params)}")

    with {:ok, %Course{} = course} <- Courses.create_course(course_params) do
      conn
      |> put_status(:created)
      |> put_resp_header("location", ~p"/api/courses/#{course}")
      |> render(:show_with_holes, course: course)
    end
  end

  def show(conn, %{"id" => id}) do
    course = Courses.get_course_with_holes!(id)
    render(conn, :show_with_holes, course: course)
  end

  def update(conn, %{"id" => id, "course" => course_params}) do
    course = Courses.get_course!(id)

    with {:ok, %Course{} = course} <- Courses.update_course(course, course_params) do
      render(conn, :show, course: course)
    end
  end

  def delete(conn, %{"id" => id}) do
    course = Courses.get_course!(id)

    with {:ok, %Course{}} <- Courses.delete_course(course) do
      send_resp(conn, :no_content, "")
    end
  end
end
