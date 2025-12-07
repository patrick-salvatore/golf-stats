defmodule GolfStatsServer.Courses.HoleDefinition do
  use Ecto.Schema
  import Ecto.Changeset

  schema "hole_definitions" do
    field(:hole_number, :integer)
    field(:par, :integer)
    field(:yardage, :integer)
    field(:handicap, :integer)
    field(:lat, :float)
    field(:lng, :float)
    field(:hazards, :map)
    belongs_to(:course, GolfStatsServer.Courses.Course)

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(hole_definition, attrs) do
    hole_definition
    |> cast(attrs, [:hole_number, :par, :yardage, :handicap, :lat, :lng, :hazards, :course_id])
    |> validate_required([:hole_number, :par, :yardage, :course_id])
  end
end
