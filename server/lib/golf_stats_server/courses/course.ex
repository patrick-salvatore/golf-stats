defmodule GolfStatsServer.Courses.Course do
  use Ecto.Schema
  import Ecto.Changeset

  schema "courses" do
    field(:name, :string)
    field(:state, :string)
    field(:city, :string)
    field(:lat, :float)
    field(:lng, :float)
    has_many(:hole_definitions, GolfStatsServer.Courses.HoleDefinition)

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(course, attrs) do
    course
    |> cast(attrs, [:name, :city, :state, :lat, :lng])
    |> validate_required([:name])
    |> cast_assoc(:hole_definitions, with: &GolfStatsServer.Courses.HoleDefinition.changeset/2)
  end
end
