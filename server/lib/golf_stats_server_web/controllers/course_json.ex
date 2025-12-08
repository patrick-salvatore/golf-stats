defmodule GolfStatsServerWeb.CourseJSON do
  alias GolfStatsServer.Courses.Course
  alias GolfStatsServer.Courses.HoleDefinition

  @doc """
  Renders a list of courses.
  """
  def index(%{courses: courses}) do
    %{data: for(course <- courses, do: data(course))}
  end

  @doc """
  Renders a single course.
  """
  def show(%{course: course}) do
    %{data: data(course)}
  end

  def show_with_holes(%{course: course}) do
    %{data: data_with_holes(course)}
  end

  defp data(%Course{} = course) do
    %{
      id: course.id,
      name: course.name,
      city: course.city,
      state: course.state,
      lat: course.lat,
      lng: course.lng
    }
  end

  defp data_with_holes(%Course{} = course) do
    Map.merge(data(course), %{
      holes: for(hole <- course.hole_definitions, do: hole_data(hole))
    })
  end

  defp hole_data(%HoleDefinition{} = hole) do
    %{
      id: hole.id,
      hole_number: hole.hole_number,
      par: hole.par,
      yardage: hole.yardage,
      handicap: hole.handicap,
      lat: hole.lat,
      lng: hole.lng,
      hazards: hole.hazards,
      geo_features: hole.geo_features
    }
  end
end
