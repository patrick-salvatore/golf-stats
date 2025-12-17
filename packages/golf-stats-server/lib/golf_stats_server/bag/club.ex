defmodule GolfStatsServer.Bag.Club do
  use Ecto.Schema
  import Ecto.Changeset

  schema "clubs" do
    field(:name, :string)
    field(:type, :string)
    belongs_to(:user, GolfStatsServer.Accounts.User)

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(club, attrs) do
    club
    |> cast(attrs, [:name, :type, :user_id])
    |> validate_required([:name, :type, :user_id])
    |> unique_constraint([:user_id, :name])
  end
end
