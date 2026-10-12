pluginManagement { includeBuild("build-logic") }
plugins { id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0" }
dependencyResolutionManagement { repositories { mavenCentral(); maven("https://repo.papermc.io/repository/maven-public/") } }
include(":api", ":plugin")
