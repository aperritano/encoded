/**
 * Manages the facet registry which directs to specific React components based on facet `field`
 * values. Unregistered fields use the default facet renderer.
 *
 * If a facet field has a value of 'assay_title' and you want to render it with the React component
 * <AssayTitleFacet>, use this to register this component for that field value:
 *
 * FacetRegistry.register('assay_title', AssayTitleFacet);
 *
 * Facet-rendering components receive these props:
 *
 * facet (object):       Relevant `facet` object in `facets` array in `results`
 * results (object):     Complete search-results object
 * pathname (string):    Search results path without query-string portion
 * queryString (string): Query-string portion of current URL without initial ?
 */

const facetRegistryCore = {};

facetRegistryCore.Facet = class {
    constructor() {
        this._registry = {};
        this._defaultFacetComponent = null;
    }

    /**
     * Internal-use method to set the default facet renderer component.
     * @param {component} defaultFacet Default facet renderer
     */
    _setDefaultFacetComponent(defaultFacet) {
        this._defaultFacetComponent = defaultFacet;
    }

    /**
     * Register a React component to render a facet with the field value matching `field`.
     * @param {string} field facet.field value to register
     * @param {array} component Rendering component to call for this field value
     */
    register(field, component) {
        this._registry[field] = component;
    }

    /**
     * Look up the views available for the given object @type. If the given @type was never
     * registered, an array of the default types gets returned. Mostly this gets used internally
     * but available for external use if needed.
     * @param {string} resultType `type` property of search result `filters` property.
     *
     * @return {array} Array of available/registered views for the given type.
     */
    lookup(field) {
        if (this._registry[field]) {
            // Registered search result type. Sort and return saved views for that type.
            return this._registry[field];
        }

        // Return the default facet if field is unregistered, or null for null facets.
        return this._registry[field] === null ? null : this._defaultFacetComponent;
    }
};

facetRegistryCore.Title = class {
    constructor() {
        this._titleRegistry = {};
        this._defaultTitleComponent = null;
    }

    /**
     * Internal-use method to set the default facet renderer component.
     * @param {component} defaultFacet Default facet renderer
     */
    _setDefaultTitleComponent(defaultTitle) {
        this._defaultTitleComponent = defaultTitle;
    }

    /**
     * Register a React component to render a facet title for the facet with a field value matching
     * `field`.
     * @param {string} field facet.field value to register
     * @param {array} component Rendering component to call for this field value
     */
    register(field, component) {
        this._titleRegistry[field] = component;
    }

    /**
     * Look up the views available for the given object @type. If the given @type was never
     * registered, an array of the default types gets returned. Mostly this gets used internally
     * but available for external use if needed.
     * @param {string} resultType `type` property of search result `filters` property.
     *
     * @return {array} Array of available/registered views for the given type.
     */
    lookup(field) {
        if (this._titleRegistry[field]) {
            // Registered search result type. Sort and return saved views for that type.
            return this._titleRegistry[field];
        }

        // Return the default facet if field is unregistered, or null for null facets.
        return this._titleRegistry[field] === null ? null : this._defaultTitleComponent;
    }
};


const FacetRegistry = {};
FacetRegistry.Facet = new facetRegistryCore.Facet();
FacetRegistry.Title = new facetRegistryCore.Title();
export default FacetRegistry;
