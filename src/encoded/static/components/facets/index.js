/**
 * `FacetRegistryCore` should only be referenced in registry.js and in this file. Custom facet
 * components should only import and reference the global `FacetRegistry`.
 *
 * Custom-component modules all need to be imported anonymously here so that they can register
 * themselves on page load.
 */
import FacetRegistry from './registry';
import { DefaultFacet, DefaultTitle } from './defaults';
// Custom facet renderer modules imported here. Keep them alphabetically sorted.
import './audit';
import './date_selector';


/**
 * This section sets the default facet renderers.
 */
FacetRegistry.Facet._setDefaultFacetComponent(DefaultFacet);
FacetRegistry.Title._setDefaultTitleComponent(DefaultTitle);


/**
 * All usage of the facet registry external to this directory should only use what gets exported
 * here.
 */
export default FacetRegistry;
