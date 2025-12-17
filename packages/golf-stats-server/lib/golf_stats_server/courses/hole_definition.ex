defmodule GolfStatsServer.Courses.HoleDefinition do
  use Ecto.Schema
  import Ecto.Changeset

  schema "hole_definitions" do
    field(:hole_number, :integer)
    field(:par, :integer)
    field(:handicap, :integer)
    field(:lat, :float)
    field(:lng, :float)
    field(:front_lat, :float)
    field(:front_lng, :float)
    field(:back_lat, :float)
    field(:back_lng, :float)
    field(:hazards, :map)
    field(:geo_features, :map)
    field(:trajectory, :map)
    belongs_to(:course, GolfStatsServer.Courses.Course)
    has_many(:tee_boxes, GolfStatsServer.Courses.TeeBox, on_replace: :delete)

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(hole_definition, attrs) do
    hole_definition
    |> cast(attrs, [
      :hole_number,
      :par,
      :handicap,
      :lat,
      :lng,
      :front_lat,
      :front_lng,
      :back_lat,
      :back_lng,
      :hazards,
      :geo_features,
      :trajectory,
      :course_id
    ])
    |> validate_required([:hole_number, :par])
    |> cast_assoc(:tee_boxes, with: &GolfStatsServer.Courses.TeeBox.changeset/2)
  end
end
