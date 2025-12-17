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
      status: course.status,
      lat: course.lat,
      lng: course.lng
    }
  end

  defp data_with_holes(%Course{} = course) do
    Map.merge(data(course), %{
      hole_definitions: for(hole <- course.hole_definitions, do: hole_data(hole))
    })
  end

  defp hole_data(%HoleDefinition{} = hole) do
    %{
      id: hole.id,
      hole_number: hole.hole_number,
      par: hole.par,
      handicap: hole.handicap,
      lat: hole.lat,
      lng: hole.lng,
      front_lat: hole.front_lat,
      front_lng: hole.front_lng,
      back_lat: hole.back_lat,
      back_lng: hole.back_lng,
      hazards: hole.hazards,
      geo_features: hole.geo_features,
      tee_boxes: tee_boxes_data(hole.tee_boxes)
    }
  end

  defp tee_boxes_data(tee_boxes) when is_list(tee_boxes) do
    for tee_box <- tee_boxes, do: tee_box_data(tee_box)
  end

  defp tee_boxes_data(_), do: []

  defp tee_box_data(tee_box) do
    %{
      id: tee_box.id,
      name: tee_box.name,
      color: tee_box.color,
      yardage: tee_box.yardage,
      lat: tee_box.lat,
      lng: tee_box.lng
    }
  end
end
