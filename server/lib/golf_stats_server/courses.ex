defmodule GolfStatsServer.Courses do
  @moduledoc """
  The Courses context.
  """
  import Ecto.Query, warn: false
  alias GolfStatsServer.Repo

  alias GolfStatsServer.Courses.Course

  alias GolfStatsServer.Courses.HoleDefinition

  @doc """
  Returns the list of courses.
  """
  def list_courses do
    from(c in Course, where: c.status == "published")
    |> Repo.all()
  end

  def list_user_drafts(user) do
    from(c in Course, where: c.user_id == ^user.id and c.status == "draft")
    |> Repo.all()
  end

  def list_user_courses(user) do
    from(c in Course, where: c.user_id == ^user.id)
    |> Repo.all()
  end

  def search_courses(query) do
    search = "%#{String.downcase(query)}%"

    from(c in Course,
      where: like(fragment("lower(?)", c.name), ^search) and c.status == "published",
      order_by: c.name
    )
    |> Repo.all()
  end

  @doc """
  Gets a single course.
  """
  def get_course!(id), do: Repo.get!(Course, id)

  def get_course_with_holes!(id) do
    Course
    |> Repo.get!(id)
    |> Repo.preload(
      hole_definitions: {from(h in HoleDefinition, order_by: h.hole_number), [:tee_boxes]}
    )
  end

  @doc """
  Creates a course.

  ## Examples

      iex> create_course(%{field: value})
      {:ok, %Course{}}

      iex> create_course(%{field: bad_value})
      {:error, %Ecto.Changeset{}}

  """
  def create_course(attrs \\ %{}) do
    %Course{}
    |> Course.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Updates a course.

  ## Examples

      iex> update_course(course, %{field: new_value})
      {:ok, %Course{}}

      iex> update_course(course, %{field: bad_value})
      {:error, %Ecto.Changeset{}}

  """
  def update_course(%Course{} = course, attrs) do
    course
    |> Course.changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Deletes a course.

  ## Examples

      iex> delete_course(course)
      {:ok, %Course{}}

      iex> delete_course(course)
      {:error, %Ecto.Changeset{}}

  """
  def delete_course(%Course{} = course) do
    Repo.delete(course)
  end

  @doc """
  Returns an `%Ecto.Changeset{}` for tracking course changes.

  ## Examples

      iex> change_course(course)
      %Ecto.Changeset{data: %Course{}}

  """
  def change_course(%Course{} = course, attrs \\ %{}) do
    Course.changeset(course, attrs)
  end

  alias GolfStatsServer.Courses.HoleDefinition

  def get_hole_definition!(id) do
    HoleDefinition
    |> Repo.get!(id)
    |> Repo.preload(:tee_boxes)
  end

  def update_hole_definition(%HoleDefinition{} = hole, attrs) do
    hole
    |> HoleDefinition.changeset(attrs)
    |> Repo.update()
  end
end
