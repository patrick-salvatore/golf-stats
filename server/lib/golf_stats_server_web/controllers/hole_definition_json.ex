defmodule GolfStatsServerWeb.HoleDefinitionJSON do
  alias GolfStatsServer.Courses.HoleDefinition

  @doc """
  Renders a list of hole_definitions.
  """
  def index(%{hole_definitions: hole_definitions}) do
    %{data: for(hole_definition <- hole_definitions, do: data(hole_definition))}
  end

  @doc """
  Renders a single hole_definition.
  """
  def show(%{hole_definition: hole_definition}) do
    %{data: data(hole_definition)}
  end

  def data(%HoleDefinition{} = hole_definition) do
    %{
      id: hole_definition.id,
      course_id: hole_definition.course_id,
      hole_number: hole_definition.hole_number,
      par: hole_definition.par,
      handicap: hole_definition.handicap,
      lat: hole_definition.lat,
      lng: hole_definition.lng,
      front_lat: hole_definition.front_lat,
      front_lng: hole_definition.front_lng,
      back_lat: hole_definition.back_lat,
      back_lng: hole_definition.back_lng,
      hazards: hole_definition.hazards,
      geo_features: hole_definition.geo_features,
      trajectory: hole_definition.trajectory,
      tee_boxes: tee_boxes_data(hole_definition.tee_boxes)
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
