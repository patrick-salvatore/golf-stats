defmodule GolfStatsServer.Bag do
  @moduledoc """
  The Bag context.
  """

  import Ecto.Query, warn: false
  alias GolfStatsServer.Repo

  alias GolfStatsServer.Bag.Club

  def list_clubs(user) do
    Repo.all(from(c in Club, where: c.user_id == ^user.id))
  end

  @doc """
  Gets a single club.

  Raises `Ecto.NoResultsError` if the Club does not exist.

  ## Examples

      iex> get_club!(123)
      %Club{}

      iex> get_club!(456)
      ** (Ecto.NoResultsError)

  """
  def get_club!(id), do: Repo.get!(Club, id)

  @doc """
  Creates a club.

  ## Examples

      iex> create_club(%{field: value})
      {:ok, %Club{}}

      iex> create_club(%{field: bad_value})
      {:error, %Ecto.Changeset{}}

  """
  def create_club(user, attrs \\ %{}) do
    %Club{}
    |> Club.changeset(Map.put(attrs, "user_id", user.id))
    |> Repo.insert()
  end

  @doc """
  Updates a club.

  ## Examples

      iex> update_club(club, %{field: new_value})
      {:ok, %Club{}}

      iex> update_club(club, %{field: bad_value})
      {:error, %Ecto.Changeset{}}

  """
  def update_club(%Club{} = club, attrs) do
    club
    |> Club.changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Deletes a club.

  ## Examples

      iex> delete_club(club)
      {:ok, %Club{}}

      iex> delete_club(club)
      {:error, %Ecto.Changeset{}}

  """
  def delete_club(%Club{} = club) do
    Repo.delete(club)
  end

  @doc """
  Returns an `%Ecto.Changeset{}` for tracking club changes.

  ## Examples

      iex> change_club(club)
      %Ecto.Changeset{data: %Club{}}

  """
  def change_club(%Club{} = club, attrs \\ %{}) do
    Club.changeset(club, attrs)
  end

  def create_bag(_user, bag) when map_size(bag) == 0 do
    []
  end

  def create_bag(user, bag) do
    Repo.transaction(fn ->
      bag
      |> Enum.map(fn {name, type} ->
        {:ok, club} = create_club(user, %{"name" => name, "type" => type})
        club
      end)
    end)
    |> case do
      {:ok, clubs} -> clubs
      {:error, reason} -> [{:error, reason}]
    end
  end
end
