defmodule GolfStatsServerWeb.Router do
  use GolfStatsServerWeb, :router

  pipeline :api do
    plug(:accepts, ["json"])
  end

  pipeline :auth do
    plug(GolfStatsServerWeb.Plugs.Auth)
  end

  scope "/api", GolfStatsServerWeb do
    pipe_through(:api)

    post("/users", UserController, :create)
    get("/club_definitions", ClubDefinitionController, :index)
  end

  scope "/api", GolfStatsServerWeb do
    pipe_through([:api, :auth])

    resources("/rounds", RoundController, except: [:new, :edit])
    resources("/courses", CourseController, except: [:new, :edit])
    resources("/holes", HoleController, except: [:new, :edit])

    resources("/clubs", ClubController, except: [:new, :edit])
    post("/bag", BagController, :create)
    put("/bag", BagController, :update)
    get("/bag", BagController, :index)

    resources("/hole_definitions", HoleDefinitionController, only: [:update])

    get("/stats", StatsController, :dashboard)

    get("/me", UserController, :me)
  end
end
